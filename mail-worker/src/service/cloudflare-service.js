import BizError from '../error/biz-error';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const cloudflareService = {

	async addDomain(c, params) {
		const { domain, workerName = 'cloud-mail' } = params;
		// 支持两种认证方式
		const cfApiToken = params.cfApiToken || c.env.cfApiToken;
		const cfApiKey = params.cfApiKey || c.env.cfApiKey;
		const cfEmail = params.cfEmail || c.env.cfEmail;

		if (!domain) {
			throw new BizError('Missing required parameter: domain');
		}

		const authHeaders = this.getAuthHeaders(cfApiToken, cfApiKey, cfEmail);

		const zoneId = await this.getZoneId(authHeaders, domain);

		await this.enableEmailRouting(authHeaders, zoneId);

		await this.setCatchAllRule(authHeaders, zoneId, workerName);

		return { success: true, domain, zoneId };
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
