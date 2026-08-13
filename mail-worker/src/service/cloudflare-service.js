import BizError from '../error/biz-error';
import KvConst from '../const/kv-const';
import settingService from './setting-service';
import domainUtils from '../utils/domain-utils';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const cloudflareService = {

	async getDomainStatuses(c) {
		const domains = await domainUtils.getAllowedDomains(c);
		const kvDomainsStr = await c.env.kv.get(KvConst.DOMAINS);
		const kvDomains = new Set((kvDomainsStr ? JSON.parse(kvDomainsStr) : []).map(domain => this.normalizeDomain(domain)));
		const setting = await settingService.query(c);
		const cfApiToken = setting.cfApiToken || c.env.cfApiToken;
		const cfApiKey = setting.cfApiKey || c.env.cfApiKey;
		const cfEmail = setting.cfEmail || c.env.cfEmail;

		let authHeaders;
		try {
			authHeaders = this.getAuthHeaders(cfApiToken, cfApiKey, cfEmail);
		} catch (_) {
			return domains.map(domain => ({ domain, status: 'unchecked', removable: kvDomains.has(this.normalizeDomain(domain)) }));
		}

		return Promise.all(domains.map(async domain => ({
			...await this.getDomainStatus(authHeaders, domain),
			removable: kvDomains.has(this.normalizeDomain(domain))
		})));
	},

	async deleteDomain(c, domainValue) {
		const domain = this.normalizeDomain(domainValue);
		if (!domain) {
			throw new BizError('Missing required parameter: domain');
		}

		const envDomains = (c.env.domain || []).map(item => this.normalizeDomain(item));
		if (envDomains.includes(domain)) {
			throw new BizError('This domain is configured by the environment and must be removed from the deployment configuration');
		}

		const domainsStr = await c.env.kv.get(KvConst.DOMAINS);
		const domains = domainsStr ? JSON.parse(domainsStr) : [];
		const nextDomains = domains.filter(item => this.normalizeDomain(item) !== domain);
		if (nextDomains.length === domains.length) {
			throw new BizError(`Domain not found: ${domain}`);
		}

		await c.env.kv.put(KvConst.DOMAINS, JSON.stringify(nextDomains));
		return { success: true, domain };
	},

	async getDomainStatus(authHeaders, domain) {
		try {
			for (const candidate of this.getZoneCandidates(domain)) {
				const response = await fetch(`${CF_API_BASE}/zones?name=${encodeURIComponent(candidate)}`, {
					headers: { ...authHeaders, 'Content-Type': 'application/json' }
				});
				const data = await response.json();

				if (!data.success) {
					return { domain, status: 'unchecked' };
				}

				if (data.result?.length) {
					const zone = data.result[0];
					const active = zone.status === 'active' && !zone.paused;
					return {
						domain,
						status: active ? 'active' : 'inactive',
						zoneStatus: zone.paused ? 'paused' : zone.status
					};
				}
			}

			return { domain, status: 'inactive', zoneStatus: 'not_found' };
		} catch (_) {
			return { domain, status: 'unchecked' };
		}
	},

	async addDomain(c, params) {
		const { workerName = 'cloud-mail' } = params;
		const domain = this.normalizeDomain(params.domain);

		// 从设置中读取 CF 配置
		const setting = await settingService.query(c);
		const cfApiToken = setting.cfApiToken || c.env.cfApiToken;
		const cfApiKey = setting.cfApiKey || c.env.cfApiKey;
		const cfEmail = setting.cfEmail || c.env.cfEmail;

		if (!domain) {
			throw new BizError('Missing required parameter: domain');
		}

		const authHeaders = this.getAuthHeaders(cfApiToken, cfApiKey, cfEmail);

		const zone = await this.getZone(authHeaders, domain);

		// 1. 获取并添加 Email Routing DNS 记录
		await this.setupEmailDns(authHeaders, zone.id, domain, zone.name);

		// 2. 启用 Email Routing
		await this.enableEmailRouting(authHeaders, zone.id);

		// 3. 设置 Catch-All 规则
		await this.setCatchAllRule(authHeaders, zone.id, workerName);

		// 4. 将域名保存到 KV
		await this.saveDomainToKv(c, domain);

		return { success: true, domain, zoneId: zone.id, zoneName: zone.name };
	},

	async saveDomainToKv(c, domain) {
		const domainsStr = await c.env.kv.get(KvConst.DOMAINS);
		const domains = domainsStr ? JSON.parse(domainsStr) : [];
		if (!domains.includes(domain)) {
			domains.push(domain);
			await c.env.kv.put(KvConst.DOMAINS, JSON.stringify(domains));
		}
	},

	async setupEmailDns(authHeaders, zoneId, domain, zoneName) {
		// 获取需要的 DNS 记录
		const dnsResponse = await fetch(`${CF_API_BASE}/zones/${zoneId}/email/routing/dns`, {
			headers: { ...authHeaders, 'Content-Type': 'application/json' }
		});
		const dnsData = await dnsResponse.json();

		if (!dnsData.success) {
			throw new BizError(`Failed to get email DNS records: ${JSON.stringify(dnsData)}`);
		}

		// 添加每条 DNS 记录
		for (const record of dnsData.result || []) {
			await this.createDnsRecord(authHeaders, zoneId, this.buildEmailDnsRecord(record, domain, zoneName));
		}
	},

	buildEmailDnsRecord(record, domain, zoneName) {
		return {
			...record,
			name: this.mapRecordNameToDomain(record.name, domain, zoneName)
		};
	},

	mapRecordNameToDomain(recordName, domain, zoneName) {
		const name = this.normalizeDnsName(recordName);
		const zone = this.normalizeDnsName(zoneName);

		if (!name || name === '@' || name === zone) {
			return domain;
		}

		if (name.endsWith(`.${zone}`)) {
			return `${name.slice(0, -zone.length)}${domain}`;
		}

		return name;
	},

	normalizeDnsName(name) {
		return (name || '').trim().replace(/\.$/, '').toLowerCase();
	},

	normalizeDomain(domain) {
		return (domain || '').trim().replace(/^@+/, '').replace(/\.$/, '').toLowerCase();
	},

	async createDnsRecord(authHeaders, zoneId, record) {
		const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
			method: 'POST',
			headers: { ...authHeaders, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: record.type,
				name: record.name,
				content: record.content,
				priority: record.priority,
				ttl: record.ttl || 1
			})
		});

		const data = await response.json();
		// 忽略已存在的记录错误 (code 81057)
		if (!data.success && !data.errors?.some(e => e.code === 81057)) {
			console.log(`DNS record creation warning: ${JSON.stringify(data)}`);
		}
	},

	getAuthHeaders(cfApiToken, cfApiKey, cfEmail) {
		// 方式1: API Token (推荐)
		if (cfApiToken) {
			const token = cfApiToken.replace(/^Bearer\s+/i, '').trim();
			return { 'Authorization': `Bearer ${token}` };
		}
		// 方式2: Global API Key + Email
		if (cfApiKey && cfEmail) {
			return {
				'X-Auth-Key': cfApiKey,
				'X-Auth-Email': cfEmail
			};
		}
		throw new BizError('Missing auth: provide cfApiToken or (cfApiKey + cfEmail)');
	},

	async getZone(authHeaders, domain) {
		let lastResponse = null;

		for (const candidate of this.getZoneCandidates(domain)) {
			const response = await fetch(`${CF_API_BASE}/zones?name=${encodeURIComponent(candidate)}`, {
				headers: { ...authHeaders, 'Content-Type': 'application/json' }
			});

			const data = await response.json();
			lastResponse = data;

			if (!data.success) {
				throw new BizError(`Failed to query Cloudflare zone for domain: ${candidate}, response: ${JSON.stringify(data)}`);
			}

			if (data.result?.length) {
				return data.result[0];
			}
		}

		throw new BizError(`Zone not found for domain: ${domain}, tried: ${this.getZoneCandidates(domain).join(', ')}, response: ${JSON.stringify(lastResponse)}`);
	},

	async getZoneId(authHeaders, domain) {
		const zone = await this.getZone(authHeaders, domain);
		return zone.id;
	},

	getZoneCandidates(domain) {
		const labels = domain.split('.').filter(Boolean);
		const candidates = [];

		for (let index = 0; index <= labels.length - 2; index++) {
			candidates.push(labels.slice(index).join('.'));
		}

		return candidates;
	},

	async enableEmailRouting(authHeaders, zoneId) {
		const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/email/routing/enable`, {
			method: 'POST',
			headers: { ...authHeaders, 'Content-Type': 'application/json' }
		});

		const data = await response.json();

		// 1001 = already enabled, 1002 = DNS records not configured
		if (!data.success && !data.errors?.some(e => e.code === 1001 || e.code === 1002)) {
			throw new BizError(`Failed to enable email routing: ${JSON.stringify(data)}`);
		}

		return data;
	},

	async setCatchAllRule(authHeaders, zoneId, workerName) {
		const body = {
			actions: [{ type: 'worker', value: [workerName] }],
			matchers: [{ type: 'all' }],
			enabled: true,
			name: 'Catch-All to Worker'
		};

		const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/email/routing/rules/catch_all`, {
			method: 'PUT',
			headers: { ...authHeaders, 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const data = await response.json();

		if (!data.success) {
			throw new BizError(`Failed to set catch-all rule: ${JSON.stringify(data)}, request: ${JSON.stringify(body)}`);
		}

		return data;
	}
};

export default cloudflareService;
