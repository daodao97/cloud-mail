import { parseHTML } from 'linkedom';
import domainUtils from '../utils/domain-uitls';

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttr(value) {
	return escapeHtml(value).replace(/`/g, '&#96;');
}

function stripDangerousMarkup(html) {
	const { document } = parseHTML(html || '');
	document.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
	document.querySelectorAll('*').forEach(node => {
		Array.from(node.attributes || []).forEach(attr => {
			const name = attr.name.toLowerCase();
			const attrValue = String(attr.value || '').trim();
			if (name.startsWith('on')) {
				node.removeAttribute(attr.name);
			}
			if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^javascript:/i.test(attrValue)) {
				node.removeAttribute(attr.name);
			}
		});
	});
	return document.toString();
}

function buildEmailBody(mail, r2Domain) {
	if (!mail) {
		return '<div class="empty-body">没有可显示的邮件</div>';
	}

	if (mail.content) {
		const ossDomain = domainUtils.toOssDomain(r2Domain);
		return stripDangerousMarkup(mail.content)
			.replace(/{{domain}}/g, ossDomain ? `${ossDomain}/` : '');
	}

	return `<pre class="plain-text">${escapeHtml(mail.text || '')}</pre>`;
}

function formatAddress(name, address) {
	const safeName = (name || '').trim();
	return safeName && safeName !== address ? `${safeName} <${address || ''}>` : address || '';
}

function buildIframeSrcdoc(mail, r2Domain) {
	const body = buildEmailBody(mail, r2Domain);
	return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
	* { box-sizing: border-box; }
	body {
		margin: 0;
		padding: 20px;
		background: #fff;
		color: #111827;
		font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
		font-size: 14px;
		line-height: 1.55;
		word-break: break-word;
	}
	img { max-width: 100% !important; height: auto !important; }
	table { max-width: 100%; }
	.plain-text { margin: 0; white-space: pre-wrap; font: inherit; }
	.empty-body { color: #6b7280; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export default function fetchmailWebHtmlTemplate({ mails = [], selectedEmailId, credentialsPath, r2Domain, error }) {
	const selected = mails.find(item => Number(item.emailId) === Number(selectedEmailId)) || mails[0] || null;
	const selectedId = selected?.emailId || '';
	const iframeSrcdoc = buildIframeSrcdoc(selected, r2Domain);
	const pageTitle = selected ? (selected.subject || '(无主题)') : '邮件预览';
	const mailLinks = mails.map(mail => {
		const active = Number(mail.emailId) === Number(selectedId) ? ' active' : '';
		const subject = mail.subject || '(无主题)';
		const sender = formatAddress(mail.name, mail.sendEmail);
		return `<a class="mail-item${active}" href="${escapeAttr(credentialsPath)}?emailId=${encodeURIComponent(mail.emailId)}">
			<div class="mail-subject">${escapeHtml(subject)}</div>
			<div class="mail-from">${escapeHtml(sender)}</div>
			<div class="mail-time">${escapeHtml(mail.createTime || '')}</div>
		</a>`;
	}).join('');

	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pageTitle)}</title>
<style>
	:root {
		color-scheme: light;
		--bg: #f3f4f6;
		--panel: #ffffff;
		--line: #e5e7eb;
		--text: #111827;
		--muted: #6b7280;
		--primary: #2563eb;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
		font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
	}
	.layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); min-height: 100vh; }
	.sidebar { background: var(--panel); border-right: 1px solid var(--line); overflow: auto; }
	.sidebar-header { position: sticky; top: 0; z-index: 1; padding: 18px 18px 14px; background: rgba(255,255,255,.96); border-bottom: 1px solid var(--line); backdrop-filter: blur(8px); }
	.sidebar-title { margin: 0; font-size: 18px; font-weight: 700; }
	.sidebar-subtitle { margin-top: 4px; color: var(--muted); font-size: 12px; }
	.mail-item { display: block; padding: 14px 18px; color: inherit; text-decoration: none; border-bottom: 1px solid var(--line); }
	.mail-item:hover { background: #f9fafb; }
	.mail-item.active { background: #eff6ff; border-left: 4px solid var(--primary); padding-left: 14px; }
	.mail-subject { font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.mail-from, .mail-time { margin-top: 5px; color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.main { min-width: 0; display: flex; flex-direction: column; }
	.message-header { padding: 18px 22px; background: var(--panel); border-bottom: 1px solid var(--line); }
	.message-title { margin: 0 0 10px; font-size: 22px; line-height: 1.3; }
	.meta { display: grid; gap: 5px; color: var(--muted); font-size: 13px; }
	.meta b { color: #374151; font-weight: 650; }
	.viewer-wrap { flex: 1; padding: 16px; min-height: 0; }
	.viewer { width: 100%; height: calc(100vh - 150px); min-height: 520px; border: 1px solid var(--line); border-radius: 12px; background: #fff; box-shadow: 0 8px 26px rgba(15,23,42,.06); }
	.empty, .error { margin: 28px; padding: 24px; border-radius: 12px; background: #fff; border: 1px solid var(--line); color: var(--muted); }
	.error { color: #b91c1c; border-color: #fecaca; background: #fff7f7; }
	@media (max-width: 820px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { max-height: 42vh; border-right: none; border-bottom: 1px solid var(--line); }
		.viewer { height: 70vh; min-height: 420px; }
	}
</style>
</head>
<body>
${error ? `<div class="error">${escapeHtml(error)}</div>` : `<div class="layout">
	<aside class="sidebar">
		<div class="sidebar-header">
			<h1 class="sidebar-title">邮件列表</h1>
			<div class="sidebar-subtitle">最近 ${mails.length} 封邮件</div>
		</div>
		${mailLinks || '<div class="empty">没有邮件</div>'}
	</aside>
	<main class="main">
		${selected ? `<header class="message-header">
			<h2 class="message-title">${escapeHtml(selected.subject || '(无主题)')}</h2>
			<div class="meta">
				<div><b>发件人：</b>${escapeHtml(formatAddress(selected.name, selected.sendEmail))}</div>
				<div><b>收件人：</b>${escapeHtml(formatAddress(selected.toName, selected.toEmail))}</div>
				<div><b>时间：</b>${escapeHtml(selected.createTime || '')}</div>
			</div>
		</header>
		<div class="viewer-wrap">
			<iframe class="viewer" sandbox="" referrerpolicy="no-referrer" srcdoc="${escapeAttr(iframeSrcdoc)}"></iframe>
		</div>` : '<div class="empty">没有可显示的邮件</div>'}
	</main>
</div>`}
</body>
</html>`;
}
