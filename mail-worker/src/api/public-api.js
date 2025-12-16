import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';
import cloudflareService from '../service/cloudflare-service';

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

app.get('/public/fetchmail/:email----:password', async (c) => {
	const { email, password } = c.req.param();
	const list = await publicService.fetchMail(c, { email, password });
	return c.json(result.ok(list));
});

app.post('/public/addDomain', async (c) => {
	const data = await cloudflareService.addDomain(c, await c.req.json());
	return c.json(result.ok(data));
});
