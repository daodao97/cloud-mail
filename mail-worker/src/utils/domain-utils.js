import KvConst from '../const/kv-const';

const domainUtils = {
	async getAllowedDomains(c) {
		const kvDomainsStr = await c.env.kv.get(KvConst.DOMAINS);
		const kvDomains = kvDomainsStr ? JSON.parse(kvDomainsStr) : [];
		const envDomains = c.env.domain || [];
		return [...new Set([...kvDomains, ...envDomains])];
	},

	async isDomainAllowed(c, domain) {
		const allowedDomains = await this.getAllowedDomains(c);
		return allowedDomains.includes(domain);
	}
};

export default domainUtils;
