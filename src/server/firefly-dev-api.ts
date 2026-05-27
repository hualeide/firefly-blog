/**
 * 仅开发环境：/__firefly/* 本地 API（写文件、读 posts 列表等）。
 * 由 src/middleware.ts 调用，不依赖 Vite configureServer 顺序。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const ALLOW_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const GALLERY_CONFIG_MARKER = "\n\t],\n\n\t// 瀑布流最小列宽(px)";
const ANNOUNCEMENT_CONFIG_PATH = path.join(projectRoot, "src", "config", "announcementConfig.ts");
const SITE_CONFIG_PATH = path.join(projectRoot, "src", "config", "siteConfig.ts");
const BACKGROUND_WALLPAPER_PATH = path.join(projectRoot, "src", "config", "backgroundWallpaper.ts");
const POSTS_DIR = path.join(projectRoot, "src", "content", "posts");

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAnnouncementQuotedField(
	source: string,
	fieldName: string,
	value: string,
): { ok: true; source: string } | { ok: false; error: string } {
	const re = new RegExp(`(\\b${escapeRe(fieldName)}:\\s*)"(?:\\\\.|[^"\\\\])*"`, "m");
	if (!re.test(source)) {
		return { ok: false, error: `在 announcementConfig.ts 中未找到字段 ${fieldName}` };
	}
	const next = source.replace(re, (_, p1: string) => p1 + JSON.stringify(value));
	return { ok: true, source: next };
}

function extractQuotedField(source: string, fieldName: string): string {
	const re = new RegExp(`\\b${escapeRe(fieldName)}:\\s*"((?:\\\\.|[^"\\\\])*)"`, "m");
	const m = source.match(re);
	if (!m) return "";
	try {
		return JSON.parse(`"${m[1]}"`) as string;
	} catch {
		return m[1];
	}
}

function replaceSiteConfigQuotedField(
	source: string,
	fieldName: string,
	value: string,
): { ok: true; source: string } | { ok: false; error: string } {
	const re = new RegExp(`(\\b${escapeRe(fieldName)}:\\s*)"(?:\\\\.|[^"\\\\])*"`, "m");
	if (!re.test(source)) {
		return { ok: false, error: `在 siteConfig.ts 中未找到字段 ${fieldName}` };
	}
	const next = source.replace(re, (_, p1: string) => p1 + JSON.stringify(value));
	return { ok: true, source: next };
}

function extractHomeBannerSubtitle(source: string): string[] {
	const re = /\/\/ 主页横幅副标题\s*\r?\n\s*subtitle:\s*\[([\s\S]*?)\],/;
	const m = source.match(re);
	if (!m) return [];
	const lines: string[] = [];
	const itemRe = /"((?:\\.|[^"\\])*)"/g;
	let im: RegExpExecArray | null;
	while ((im = itemRe.exec(m[1])) !== null) {
		try {
			lines.push(JSON.parse(`"${im[1]}"`) as string);
		} catch {
			lines.push(im[1]);
		}
	}
	return lines;
}

function replaceHomeBannerSubtitle(
	source: string,
	lines: string[],
): { ok: true; source: string } | { ok: false; error: string } {
	const re =
		/(\/\/ 主页横幅副标题\s*\r?\n\s*subtitle:\s*)\[[\s\S]*?\](\s*,\s*\r?\n\s*\/\/ 主页横幅副标题字体大小)/;
	if (!re.test(source)) {
		return { ok: false, error: "在 backgroundWallpaper.ts 中未找到 homeText.subtitle 数组" };
	}
	const inner = lines.map((l) => `\t\t\t${JSON.stringify(l)},`).join("\n");
	const next = source.replace(re, `$1[\n${inner}\n\t\t\t]$2`);
	return { ok: true, source: next };
}

function extractHomeBannerTitle(source: string): string {
	const re = /\/\/ 主页横幅主标题\s*\r?\n\s*title:\s*"((?:\\.|[^"\\])*)"/;
	const m = source.match(re);
	if (!m) return "";
	try {
		return JSON.parse(`"${m[1]}"`) as string;
	} catch {
		return m[1];
	}
}

function replaceHomeBannerTitle(
	source: string,
	value: string,
): { ok: true; source: string } | { ok: false; error: string } {
	const re = /(\/\/ 主页横幅主标题\s*\r?\n\s*title:\s*)"[^"]*"/;
	if (!re.test(source)) {
		return { ok: false, error: "在 backgroundWallpaper.ts 中未找到 homeText.title" };
	}
	const next = source.replace(re, `$1${JSON.stringify(value)}`);
	return { ok: true, source: next };
}

function formatPublishedForFrontmatter(value: string): string {
	const v = String(value ?? "").trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
	return d.toISOString().slice(0, 10);
}

function handleContentOverview() {
	const siteSrc = fs.readFileSync(SITE_CONFIG_PATH, "utf8");
	const bgSrc = fs.readFileSync(BACKGROUND_WALLPAPER_PATH, "utf8");
	const annSrc = fs.readFileSync(ANNOUNCEMENT_CONFIG_PATH, "utf8");
	return {
		ok: true as const,
		types: {
			announcement: {
				label: "公告（侧栏）",
				file: "src/config/announcementConfig.ts",
				hint: "显示在侧栏公告组件，不是文章",
			},
			homepage: {
				label: "主页（站点名 + 横幅字）",
				files: ["src/config/siteConfig.ts", "src/config/backgroundWallpaper.ts"],
				hint: "首页列表来自文章集合；此处改站点标题与顶部横幅文案",
			},
			posts: {
				label: "文章（博客正文）",
				dir: "src/content/posts/",
				hint: "每篇对应 /posts/{slug}/，含 frontmatter + Markdown 正文",
			},
		},
		announcement: {
			title: extractQuotedField(annSrc, "title"),
			content: extractQuotedField(annSrc, "content"),
			linkText: extractQuotedField(annSrc, "text"),
			linkUrl: extractQuotedField(annSrc, "url"),
			closable: /\bclosable:\s*true\b/.test(annSrc),
		},
		homepage: {
			siteTitle: extractQuotedField(siteSrc, "title"),
			siteSubtitle: extractQuotedField(siteSrc, "subtitle"),
			siteDescription: extractQuotedField(siteSrc, "description"),
			bannerTitle: extractHomeBannerTitle(bgSrc),
			bannerSubtitles: extractHomeBannerSubtitle(bgSrc),
		},
	};
}

function handleHomepageSave(body: Record<string, unknown>) {
	if (!fs.existsSync(SITE_CONFIG_PATH) || !fs.existsSync(BACKGROUND_WALLPAPER_PATH)) {
		return { ok: false as const, error: "缺少 siteConfig.ts 或 backgroundWallpaper.ts" };
	}
	let siteSrc = fs.readFileSync(SITE_CONFIG_PATH, "utf8");
	let bgSrc = fs.readFileSync(BACKGROUND_WALLPAPER_PATH, "utf8");

	const siteTitle = body.siteTitle != null ? String(body.siteTitle) : null;
	const siteSubtitle = body.siteSubtitle != null ? String(body.siteSubtitle) : null;
	const siteDescription = body.siteDescription != null ? String(body.siteDescription) : null;
	const bannerTitle = body.bannerTitle != null ? String(body.bannerTitle) : null;
	const bannerSubtitles = body.bannerSubtitles;

	if (siteTitle !== null) {
		const r = replaceSiteConfigQuotedField(siteSrc, "title", siteTitle);
		if (!r.ok) return r;
		siteSrc = r.source;
	}
	if (siteSubtitle !== null) {
		const r = replaceSiteConfigQuotedField(siteSrc, "subtitle", siteSubtitle);
		if (!r.ok) return r;
		siteSrc = r.source;
	}
	if (siteDescription !== null) {
		const r = replaceSiteConfigQuotedField(siteSrc, "description", siteDescription);
		if (!r.ok) return r;
		siteSrc = r.source;
	}
	if (bannerTitle !== null) {
		const r = replaceHomeBannerTitle(bgSrc, bannerTitle);
		if (!r.ok) return r;
		bgSrc = r.source;
	}
	if (bannerSubtitles != null) {
		const lines = Array.isArray(bannerSubtitles)
			? bannerSubtitles.map((s) => String(s).trim()).filter(Boolean)
			: String(bannerSubtitles)
					.split(/\r?\n/)
					.map((s) => s.trim())
					.filter(Boolean);
		const r = replaceHomeBannerSubtitle(bgSrc, lines);
		if (!r.ok) return r;
		bgSrc = r.source;
	}

	fs.writeFileSync(SITE_CONFIG_PATH, siteSrc, "utf8");
	fs.writeFileSync(BACKGROUND_WALLPAPER_PATH, bgSrc, "utf8");
	return {
		ok: true as const,
		message: "已保存主页相关配置（站点名 + 横幅）。刷新首页查看效果。",
	};
}

function handlePostRead(url: URL) {
	const rel = String(url.searchParams.get("path") ?? "").trim().replace(/\\/g, "/");
	if (!rel) return { ok: false as const, error: "缺少 path 查询参数" };
	const r = resolvePathUnderPosts(rel);
	if (!r.ok) return r;
	if (!fs.existsSync(r.absFile)) {
		return { ok: false as const, error: "文件不存在" };
	}
	const raw = fs.readFileSync(r.absFile, "utf8");
	const parsed = matter(raw);
	const published = parsed.data.published;
	let publishedStr = "";
	if (published instanceof Date) {
		publishedStr = published.toISOString().slice(0, 10);
	} else if (published != null) {
		publishedStr = String(published).slice(0, 10);
	}
	return {
		ok: true as const,
		path: rel,
		raw,
		data: {
			title: String(parsed.data.title ?? ""),
			published: publishedStr,
			draft: Boolean(parsed.data.draft),
			description: String(parsed.data.description ?? ""),
			category: String(parsed.data.category ?? ""),
			tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
			pinned: Boolean(parsed.data.pinned),
		},
		body: parsed.content,
	};
}

function handlePostSave(body: Record<string, unknown>) {
	const rel = String(body.path ?? "").trim().replace(/\\/g, "/");
	if (!rel) return { ok: false as const, error: "缺少 path" };
	const r = resolvePathUnderPosts(rel);
	if (!r.ok) return r;
	if (!fs.existsSync(r.absFile)) {
		return { ok: false as const, error: "文件不存在" };
	}

	const title = String(body.title ?? "").trim();
	if (!title) return { ok: false as const, error: "标题不能为空" };

	const published = formatPublishedForFrontmatter(String(body.published ?? ""));
	const draft = Boolean(body.draft);
	const description = String(body.description ?? "");
	const category = String(body.category ?? "");
	const tags = Array.isArray(body.tags)
		? body.tags.map((t) => String(t).trim()).filter(Boolean)
		: String(body.tags ?? "")
				.split(/[,，]/)
				.map((s) => s.trim())
				.filter(Boolean);
	const pinned = Boolean(body.pinned);
	const contentBody = String(body.body ?? "");

	const existing = matter(fs.readFileSync(r.absFile, "utf8"));
	const data: Record<string, unknown> = { ...(existing.data as Record<string, unknown>) };
	data.title = title;
	data.published = published;
	data.draft = draft;
	data.description = description;
	data.category = category;
	data.tags = tags;
	data.pinned = pinned;
	delete data.prevTitle;
	delete data.prevSlug;
	delete data.nextTitle;
	delete data.nextSlug;

	const out = matter.stringify(contentBody, data);
	fs.writeFileSync(r.absFile, out, "utf8");
	return {
		ok: true as const,
		message: `已保存 src/content/posts/${rel}`,
	};
}

function handleGalleryCreateAlbum(body: Record<string, unknown>) {
	const rawId = String(body.id ?? "").trim();
	const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
	if (!id || id !== rawId) {
		return { ok: false as const, error: "相册 id 仅允许字母、数字、英文下划线与连字符（建议小写+连字符，如 my-trip-2026）" };
	}
	const name = String(body.name ?? "").trim();
	if (!name) {
		return { ok: false as const, error: "请填写相册显示名称" };
	}

	const configPath = path.join(projectRoot, "src", "config", "galleryConfig.ts");
	if (!fs.existsSync(configPath)) {
		return { ok: false as const, error: "未找到 src/config/galleryConfig.ts" };
	}
	let content = fs.readFileSync(configPath, "utf8");
	if (new RegExp(`\\bid:\\s*"${escapeRe(id)}"`).test(content)) {
		return { ok: false as const, error: `相册 id「${id}」已存在于配置中` };
	}
	if (!content.includes(GALLERY_CONFIG_MARKER)) {
		return {
			ok: false as const,
			error:
				"galleryConfig.ts 中未找到预期标记（// 瀑布流最小列宽(px)…），请手动添加相册或恢复该注释段落。",
		};
	}

	const description = String(body.description ?? "").trim();
	const location = String(body.location ?? "").trim();
	let date = String(body.date ?? "").trim();
	if (!date) {
		const d = new Date();
		date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}
	const tagsRaw = body.tags;
	const tags = Array.isArray(tagsRaw)
		? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
		: String(tagsRaw ?? "")
				.split(/[,，]/)
				.map((s) => s.trim())
				.filter(Boolean);

	const lines = ["\t\t{", `\t\t\tid: ${JSON.stringify(id)},`, `\t\t\tname: ${JSON.stringify(name)},`];
	if (description) lines.push(`\t\t\tdescription: ${JSON.stringify(description)},`);
	if (location) lines.push(`\t\t\tlocation: ${JSON.stringify(location)},`);
	lines.push(`\t\t\tdate: ${JSON.stringify(date)},`);
	if (tags.length) lines.push(`\t\t\ttags: ${JSON.stringify(tags)},`);
	lines.push("\t\t},");
	const insertion = `\n${lines.join("\n")}`;

	const idx = content.indexOf(GALLERY_CONFIG_MARKER);
	const newContent = content.slice(0, idx) + insertion + content.slice(idx);
	fs.writeFileSync(configPath, newContent, "utf8");

	const dir = path.join(projectRoot, "public", "gallery", id);
	fs.mkdirSync(dir, { recursive: true });

	return {
		ok: true as const,
		id,
		message: "已写入 galleryConfig.ts 并创建 public/gallery/" + id + "/。若页面未更新请重启一次 dev。",
	};
}

function handleAnnouncementSave(body: Record<string, unknown>) {
	if (!fs.existsSync(ANNOUNCEMENT_CONFIG_PATH)) {
		return { ok: false as const, error: "未找到 src/config/announcementConfig.ts" };
	}
	const title = body.title != null ? String(body.title) : null;
	const content = body.content != null ? String(body.content) : null;
	const linkText = body.linkText != null ? String(body.linkText) : null;
	const linkUrl = body.linkUrl != null ? String(body.linkUrl) : null;
	if (title === null && content === null && linkText === null && linkUrl === null) {
		return { ok: false as const, error: "请求体至少包含 title / content / linkText / linkUrl 之一" };
	}
	const maxLen = 8000;
	for (const [k, v] of Object.entries({ title, content, linkText, linkUrl })) {
		if (v !== null && v.length > maxLen) {
			return { ok: false as const, error: `字段 ${k} 过长（>${maxLen}）` };
		}
	}
	let src = fs.readFileSync(ANNOUNCEMENT_CONFIG_PATH, "utf8");
	if (title !== null) {
		const r = replaceAnnouncementQuotedField(src, "title", title);
		if (!r.ok) return r;
		src = r.source;
	}
	if (content !== null) {
		const r = replaceAnnouncementQuotedField(src, "content", content);
		if (!r.ok) return r;
		src = r.source;
	}
	if (linkText !== null) {
		const r = replaceAnnouncementQuotedField(src, "text", linkText);
		if (!r.ok) return r;
		src = r.source;
	}
	if (linkUrl !== null) {
		const r = replaceAnnouncementQuotedField(src, "url", linkUrl);
		if (!r.ok) return r;
		src = r.source;
	}
	fs.writeFileSync(ANNOUNCEMENT_CONFIG_PATH, src, "utf8");
	return {
		ok: true as const,
		message: "已写入 src/config/announcementConfig.ts。页面将刷新以载入新文案。",
	};
}

function resolvePathUnderPosts(
	relPosix: string,
): { ok: true; absFile: string } | { ok: false; error: string } {
	const rel = String(relPosix ?? "")
		.trim()
		.replace(/\\/g, "/");
	if (!rel || rel.includes("..")) {
		return { ok: false, error: "路径不合法" };
	}
	const absPosts = path.resolve(POSTS_DIR);
	const absFile = path.resolve(POSTS_DIR, rel);
	if (absFile !== absPosts && !absFile.startsWith(absPosts + path.sep)) {
		return { ok: false, error: "禁止越权路径" };
	}
	if (!/\.(md|mdx)$/i.test(absFile)) {
		return { ok: false, error: "只能操作 .md / .mdx" };
	}
	return { ok: true, absFile };
}

function walkPostFiles(dir: string, baseRel = ""): string[] {
	const list: string[] = [];
	if (!fs.existsSync(dir)) return list;
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const name = ent.name;
		if (name.startsWith(".")) continue;
		const rel = baseRel ? `${baseRel}/${name}` : name;
		const full = path.join(dir, name);
		if (ent.isDirectory()) {
			list.push(...walkPostFiles(full, rel));
		} else if (/\.(md|mdx)$/i.test(name)) {
			list.push(rel.replace(/\\/g, "/"));
		}
	}
	return list;
}

function handlePostList() {
	const files = walkPostFiles(POSTS_DIR).sort();
	return { ok: true as const, files };
}

function handlePostCreate(body: Record<string, unknown>) {
	const fmt = body.format === "mdx" ? "mdx" : "md";
	const slugRaw = String(body.slug ?? "").trim();
	const base = slugRaw.replace(/\.(md|mdx)$/i, "");
	if (!/^[a-zA-Z0-9_-]+$/.test(base)) {
		return {
			ok: false as const,
			error: "新建仅支持「单层」文件名 slug：字母、数字、下划线、连字符（不要子目录，如 my-post）",
		};
	}
	const title = String(body.title ?? base).trim() || base;
	const relPath = `${base}.${fmt}`;
	const absFile = path.join(POSTS_DIR, relPath);
	if (!resolvePathUnderPosts(relPath).ok) {
		return { ok: false as const, error: "路径校验失败" };
	}
	if (fs.existsSync(absFile)) {
		return { ok: false as const, error: `文件已存在：src/content/posts/${relPath}` };
	}
	fs.mkdirSync(path.dirname(absFile), { recursive: true });
	const today = new Date().toISOString().slice(0, 10);
	const md = `---
title: ${JSON.stringify(title)}
published: ${today}
draft: false
description: ''
image: ''
tags: []
category: ''
lang: ''
pinned: false
---

## 新文章

正文从这里开始。
`;
	fs.writeFileSync(absFile, md, "utf8");
	return {
		ok: true as const,
		path: `src/content/posts/${relPath}`,
		message: `已创建 src/content/posts/${relPath}，请刷新页面或等待热更新。`,
	};
}

function handlePostDelete(body: Record<string, unknown>) {
	const rel = String(body.path ?? "").trim().replace(/\\/g, "/");
	if (!rel) {
		return { ok: false as const, error: "缺少 path（相对 src/content/posts 的路径）" };
	}
	const r = resolvePathUnderPosts(rel);
	if (!r.ok) return r;
	if (!fs.existsSync(r.absFile)) {
		return { ok: false as const, error: "文件不存在" };
	}
	const st = fs.statSync(r.absFile);
	if (!st.isFile()) {
		return { ok: false as const, error: "目标不是文件" };
	}
	fs.unlinkSync(r.absFile);
	return { ok: true as const, message: `已删除 src/content/posts/${rel}` };
}

async function handleGalleryUploadFormData(request: Request): Promise<Response> {
	const formData = await request.formData();
	const albumId = String(formData.get("albumId") ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
	if (!albumId) {
		return json({ ok: false, error: "缺少 albumId" }, 400);
	}
	const dir = path.join(projectRoot, "public", "gallery", albumId);
	fs.mkdirSync(dir, { recursive: true });

	const saved: string[] = [];
	const files = formData.getAll("file");
	for (const entry of files) {
		if (!(entry instanceof File) || entry.size === 0) continue;
		const ext = path.extname(entry.name || "").toLowerCase();
		if (!ALLOW_EXT.has(ext)) continue;
		const buf = Buffer.from(await entry.arrayBuffer());
		const base = path.basename(entry.name || "img", ext);
		const safe = base.replace(/[^\w\-.]/gu, "_").slice(0, 80) || "img";
		const destName = `${safe}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}${ext}`;
		const destPath = path.join(dir, destName);
		fs.writeFileSync(destPath, buf);
		saved.push(destName);
	}
	if (saved.length === 0) {
		return json({ ok: false, error: "没有写入任何图片（检查格式、albumId、或是否选择了文件）" }, 400);
	}
	return json({ ok: true, albumId, saved });
}

function isOk(r: unknown): r is { ok: true } {
	return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}

/**
 * 处理 /__firefly/*（pathname 已去掉尾斜杠、且不含 base 前缀）。
 */
export async function handleFireflyDevRequest(request: Request, pathname: string): Promise<Response> {
	try {
		if (pathname === "/__firefly/content-overview" && request.method === "GET") {
			return json(handleContentOverview());
		}

		if (pathname === "/__firefly/homepage-save" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handleHomepageSave(body);
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/post-read" && request.method === "GET") {
			const out = handlePostRead(new URL(request.url));
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/post-save" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handlePostSave(body);
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/post-list" && request.method === "GET") {
			return json(handlePostList());
		}

		if (pathname === "/__firefly/post-create" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handlePostCreate(body);
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/post-delete" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handlePostDelete(body);
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/announcement-save" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handleAnnouncementSave(body);
			if ("ok" in out && out.ok === false) {
				return json(out, 400);
			}
			return json(out, 200);
		}

		if (pathname === "/__firefly/gallery-create-album" && request.method === "POST") {
			const ct = request.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				return json({ ok: false, error: "Content-Type 须为 application/json" }, 415);
			}
			const body = (await request.json()) as Record<string, unknown>;
			const out = handleGalleryCreateAlbum(body);
			return json(out, isOk(out) ? 200 : 400);
		}

		if (pathname === "/__firefly/gallery-upload" && request.method === "POST") {
			return handleGalleryUploadFormData(request);
		}

		return json({ ok: false, error: `未知的 __firefly 路径：${pathname}` }, 404);
	} catch (e) {
		return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
	}
}
