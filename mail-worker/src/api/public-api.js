import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';
import cloudflareService from '../service/cloudflare-service';
import domainUtils from '../utils/domain-utils';
import fetchmailWebHtmlTemplate from '../template/fetchmail-web-html';
import settingService from '../service/setting-service';

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

function parseFetchmailCredentials(credentials) {
	let email = '';
	let password = '';

	if (credentials.includes('----')) {
		const parts = credentials.split('----');
		email = parts[0] || '';
		password = parts.slice(1).join('----');
	} else {
		const separatorIndex = credentials.indexOf(':');
		if (separatorIndex !== -1) {
			email = credentials.slice(0, separatorIndex);
			password = credentials.slice(separatorIndex + 1);
		}
	}

	return { email, password };
}

app.get('/public/mail/:credentials', async (c) => {
	const credentials = c.req.param('credentials');
	const params = parseFetchmailCredentials(credentials);
	const url = new URL(c.req.url);
	try {
		const list = await publicService.fetchMail(c, params);
		let r2Domain = '';
		try {
			const setting = await settingService.query(c);
			r2Domain = setting.r2Domain || '';
		} catch (_) {
			// 邮件正文仍可渲染；只有 {{domain}} 图片占位符无法被替换。
		}
		const credentialsPath = url.pathname.startsWith('/api/') ? url.pathname : `/api${url.pathname}`;
		return c.html(fetchmailWebHtmlTemplate({
			mails: list,
			selectedEmailId: url.searchParams.get('emailId'),
			credentialsPath,
			r2Domain
		}));
	} catch (e) {
		if (e.name === 'BizError') {
			return c.html(fetchmailWebHtmlTemplate({ error: e.message }), e.code || 500);
		}
		throw e;
	}
});

app.get('/public/fetchmail/:credentials', async (c) => {
	const credentials = c.req.param('credentials');
	const list = await publicService.fetchMail(c, parseFetchmailCredentials(credentials));
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
