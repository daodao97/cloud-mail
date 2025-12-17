import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';
import cloudflareService from '../service/cloudflare-service';
import domainUtils from '../utils/domain-utils';

app.post('/public/genToken', async (c) => {
	const data = await publicService.genToken(c, await c.req.json());
	return c.json(result.ok(data));
});

app.post('/public/emailList', async (c) => {
	const list = await publicService.emailList(c, await c.req.json());
	return c.json(result.ok(list));
});

app.post('/public/addUser', async (c) => {
	await publicService.addUser(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/public/fetchmail/:credentials', async (c) => {
	const credentials = c.req.param('credentials');
	const [email, password] = credentials.split('----');
	const list = await publicService.fetchMail(c, { email, password });
	return c.json(result.ok(list));
});

app.post('/public/addDomain', async (c) => {
	const data = await cloudflareService.addDomain(c, await c.req.json());
	return c.json(result.ok(data));
});

app.get('/public/domainList', async (c) => {
	const domains = await domainUtils.getAllowedDomains(c);
	return c.json(result.ok(domains));
});
