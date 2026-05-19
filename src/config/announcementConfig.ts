import type { AnnouncementConfig } from "../types/config";

/** 开发环境可在页面「编辑模式」中内联修改并保存到本文件（POST /__firefly/announcement-save/，尾斜杠与 astro trailingSlash 一致）。 */
export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告内容
	content: "我……看不到你所在的世界……",

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "了解更多",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};
