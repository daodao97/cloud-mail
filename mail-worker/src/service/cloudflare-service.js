import BizError from '../error/biz-error';
import KvConst from '../const/kv-const';
import settingService from './setting-service';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const cloudflareService = {

	async addDomain(c, params) {
		const { domain, workerName = 'cloud-mail' } = params;

		// 从设置中读取 CF 配置
		const setting = await settingService.query(c);
		const cfApiToken = setting.cfApiToken || c.env.cfApiToken;
		const cfApiKey = setting.cfApiKey || c.env.cfApiKey;
		const cfEmail = setting.cfEmail || c.env.cfEmail;

		if (!domain) {
			throw new BizError('Missing required parameter: domain');
		}

		const authHeaders = this.getAuthHeaders(cfApiToken, cfApiKey, cfEmail);

		const zoneId = await this.getZoneId(authHeaders, domain);

		// 1. 获取并添加 Email Routing DNS 记录
		await this.setupEmailDns(authHeaders, zoneId);

		// 2. 启用 Email Routing
		await this.enableEmailRouting(authHeaders, zoneId);

		// 3. 设置 Catch-All 规则
		await this.setCatchAllRule(authHeaders, zoneId, workerName);

		// 4. 将域名保存到 KV
		await this.saveDomainToKv(c, domain);

		return { success: true, domain, zoneId };
	},

	async saveDomainToKv(c, domain) {
		const domainsStr = await c.env.kv.get(KvConst.DOMAINS);
		const domains = domainsStr ? JSON.parse(domainsStr) : [];
		if (!domains.includes(domain)) {
			domains.push(domain);
			await c.env.kv.put(KvConst.DOMAINS, JSON.stringify(domains));
		}
	},

	async setupEmailDns(authHeaders, zoneId) {
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
			await this.createDnsRecord(authHeaders, zoneId, record);
		}
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

	async getZoneId(authHeaders, domain) {
		const response = await fetch(`${CF_API_BASE}/zones?name=${domain}`, {
			headers: { ...authHeaders, 'Content-Type': 'application/json' }
		});

		const data = await response.json();

		if (!data.success || !data.result?.length) {
			throw new BizError(`Zone not found for domain: ${domain}, response: ${JSON.stringify(data)}`);
		}

		return data.result[0].id;
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
