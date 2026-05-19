import { defineMiddleware } from "astro:middleware";
import { handleFireflyDevRequest } from "./server/firefly-dev-api";

/**
 * 开发环境拦截 /__firefly/*，走本地 JSON API（见 src/server/firefly-dev-api.ts）。
 * 不依赖 Vite 中间件顺序，避免请求落到 Astro SSR 返回整页 HTML。
 */
export const onRequest = defineMiddleware(async (context, next) => {
	if (!import.meta.env.DEV) {
		return next();
	}

	const url = new URL(context.request.url);
	let pathname = url.pathname;
	const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
	if (base && pathname.startsWith(base)) {
		pathname = pathname.slice(base.length) || "/";
	}
	if (!pathname.startsWith("/")) {
		pathname = "/" + pathname;
	}
	pathname = pathname.replace(/\/+$/, "") || "/";

	if (!pathname.startsWith("/__firefly")) {
		return next();
	}

	return handleFireflyDevRequest(context.request, pathname);
});
