import BizError from '../error/biz-error';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const cloudflareService = {

	async addDomain(c, params) {
		const { domain, workerName = 'cloud-mail' } = params;
		// 优先从请求参数获取，否则从环境变量获取
		let cfApiToken = params.cfApiToken || c.env.cfApiToken;

		if (!domain) {
			throw new BizError('Missing required parameter: domain');
		}

		if (!cfApiToken) {
			throw new BizError('Missing cfApiToken: provide in request body or environment variable');
		}

		// 移除可能存在的 "Bearer " 前缀
		cfApiToken = cfApiToken.replace(/^Bearer\s+/i, '').trim();

		const zoneId = await this.getZoneId(cfApiToken, domain);

		await this.enableEmailRouting(cfApiToken, zoneId);

		await this.setCatchAllRule(cfApiToken, zoneId, workerName);

		return { success: true, domain, zoneId };
	},

	async getZoneId(cfApiToken, domain) {
		const response = await fetch(`${CF_API_BASE}/zones?name=${domain}`, {
			headers: {
				'Authorization': `Bearer ${cfApiToken}`,
				'Content-Type': 'application/json'
			}
		});

		const data = await response.json();

		if (!data.success || !data.result?.length) {
			throw new BizError(`Zone not found for domain: ${domain}, response: ${JSON.stringify(data)}`);
		}

		return data.result[0].id;
	},

	async enableEmailRouting(cfApiToken, zoneId) {
		const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/email/routing/enable`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${cfApiToken}`,
				'Content-Type': 'application/json'
			}
		});

		const data = await response.json();

		// 1001 = already enabled, 1002 = DNS records not configured
		if (!data.success && !data.errors?.some(e => e.code === 1001 || e.code === 1002)) {
			throw new BizError(`Failed to enable email routing: ${JSON.stringify(data)}`);
		}

		return data;
	},

	async setCatchAllRule(cfApiToken, zoneId, workerName) {
		const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/email/routing/rules/catch_all`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${cfApiToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				actions: [{ type: 'worker', value: [workerName] }],
				matchers: [{ type: 'all' }],
				enabled: true,
				name: 'Catch-All to Worker'
			})
		});

		const data = await response.json();

		if (!data.success) {
			throw new BizError(`Failed to set catch-all rule: ${JSON.stringify(data.errors)}`);
		}

		return data;
	}
};

export default cloudflareService;
