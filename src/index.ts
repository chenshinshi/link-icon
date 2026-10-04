"use strict";
// const siyuan = require("siyuan");
import * as siyuan from "siyuan";

import { manageCustomIcons, uploadCustomIcon, useDynamicStyle } from "./custom-icon";

import './style.css';

const ICON_CLASS = "plugin-link-icon";
const EVENT_LOADED_PROTYLE = 'loaded-protyle-static';
// 动态图标前缀，与思源 kernel/util.FilterIconValue 及 app/src/emoji/iconValue.ts 的判定保持一致
const DYNAMIC_ICON_PREFIX = 'api/icon/';
// 十六进制码点（可用 - 连接多个码点，如 1f468-200d-1f4bb）
const UNICODE_ICON_PATTERN = /^[0-9a-fA-F]+(?:-[0-9a-fA-F]+)*$/;

type TEventLoadedProtyle = CustomEvent<siyuan.IEventBusMap['loaded-protyle-static']>;

async function request(url, data) {
    // info(`Request: ${url}; data = ${JSON.stringify(data)}`);
    let response = await siyuan.fetchSyncPost(url, data);
    // console.log(response);
    let res = response.code === 0 ? response.data : null;
    return res;
}


async function sql(sql) {
    let sqldata = {
        stmt: sql,
    };
    let url = '/api/query/sql';
    return request(url, sqldata);
}

/**
 * 获取文档块的图标
 * @param {string} block_id
 */
async function queryDocIcon(block_id) {
    //如果不是文档块，则不添加图标
    let blocks = await sql(`select * from blocks where id = '${block_id}'`);
    if (blocks?.length === 0 || blocks[0].type !== 'd') {
        // console.log(`block ${block_id} is not a doc`)
        return null;
    }

    let response = await siyuan.fetchSyncPost(
        '/api/block/getDocInfo',
        {
            id: block_id
        }
    );
    if (response.code !== 0) {
        return null;
    }

    let icon_code = response.data.icon;
    let sub_file_cnt = response.data.subFileCount;

    // 默认文档图标
    if (icon_code === "") {
        let code = sub_file_cnt > 0 ? '📑' : '📄';
        let dom = `<span data-type="text" class="${ICON_CLASS}">${code}</span>`
        return {
            type: 'unicode',
            dom: dom,
            code: code
        }
    }

    let result = {
        type: "unicode",
        dom: "",
        code: icon_code
    }
    //使用了自定义的 svg 图标 vs 使用 unicode 编码的 emoji
    if (icon_code.startsWith(DYNAMIC_ICON_PREFIX)) {
        //思源的动态图标，值形如 api/icon/getDynamicIcon?type=8&color=%23d23f31&content=Sy&id=xxx
        //这类图标由内核按需渲染，直接按图片引用，不能按 emoji 或 /emojis 路径处理
        result.type = "dynamic";
        let src = icon_code.replace(/&amp;/g, "&");
        result.dom = `<img alt="${icon_code}" class="emoji ${ICON_CLASS}" src="${src}" title="${icon_code}">`
    } else if (icon_code.toLowerCase().endsWith(".svg")) {
        result.type = "svg";
        result.dom = `<img alt="${icon_code}" class="emoji ${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}">`
    } else if (icon_code.toLowerCase().match(/\.(jpeg|jpg|png)$/)) {
        result.type = "image";
        result.dom = `<img alt="${icon_code}" class="${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}" style="width: 1.625em; height: 1.625em; padding-right: 3px; padding-bottom:3px; border-radius: 0.5em">`
    } else if (UNICODE_ICON_PATTERN.test(icon_code)) {
        result.type = "unicode";
        result.code = icon_code.split("-").map(code => String.fromCodePoint(parseInt(code, 16))).join("");
        result.dom = `<span data-type="text" class="${ICON_CLASS}">${result.code}</span>`
    } else {
        //无法识别的图标值，不插入图标（此前会解析出码点 10 等无效字符，既显示不出图标又会在块内换行）
        return null;
    }

    return result;
}

function isUnicodeEmoji(text) {
    const regex = /\p{Emoji}/u;
    return regex.test(text);
}

const ConfigFile = 'config.json';
const customIconsFile = 'custom-icons.json';

const simpleDialog = (args: {
    title: string, ele: HTMLElement | DocumentFragment,
    width?: string, height?: string,
    callback?: () => void;
}) => {
    const dialog = new siyuan.Dialog({
        title: args.title,
        content: `<div class="dialog-content" style="display: flex; height: 100%;"/>`,
        width: args.width,
        height: args.height,
        destroyCallback: args.callback
    });
    dialog.element.querySelector(".dialog-content").appendChild(args.ele);
    return dialog;
}

const dynamicStyle = useDynamicStyle();

export default class LinkIconPlugin extends siyuan.Plugin {

    Listener = this.listeners.bind(this);

    config = {
        InsertDocRefIcon: true,
        InsertDocLinkIcon: false
    }

    customIcons: { href: string, iconUrl: string }[] = []

    async onload() {
        this.initUI();

        let conf = await this.loadData(ConfigFile);
        let customIcons = await this.loadData(customIconsFile);
        this.customIcons = customIcons || [];
        if (conf) {
            for (let key in this.config) {
                let val = conf?.[key];
                if (val !== undefined) {
                    this.config[key] = val;
                }
            }
        }
        this.customIcons.forEach(icon => {
            dynamicStyle.addIcon(icon.href, icon.iconUrl, false);
        });
        dynamicStyle.flushStyle();
        this.eventBus.on(EVENT_LOADED_PROTYLE, this.Listener);
    }

    async onunload() {
        this.eventBus.off(EVENT_LOADED_PROTYLE, this.Listener);
        dynamicStyle.clearStyle();
    }

    initUI() {
        const inputDocRef = document.createElement('input');
        inputDocRef.type = 'checkbox';
        inputDocRef.className = "b3-switch fn__flex-center";
        const inputDocLink = document.createElement('input');
        inputDocLink.type = 'checkbox';
        inputDocLink.className = "b3-switch fn__flex-center";
        const uploadBtn = document.createElement('button');
        uploadBtn.className = "b3-button fn__size200";
        uploadBtn.textContent = this.i18n.upload;
        uploadBtn.addEventListener('click', async () => {
            let ele = uploadCustomIcon((hrefName: string, url: string) => {
                dialog.destroy();
                this.onCustomIconUpload(hrefName, url);
            });
            const dialog = simpleDialog({
                title: this.i18n.upload,
                ele: ele,
                width: '700px',
            });
        });
        const manageBtn = document.createElement('button');
        manageBtn.className = "b3-button fn__size200";
        manageBtn.textContent = this.i18n.manage;
        manageBtn.addEventListener('click', async () => {
            let ele = manageCustomIcons(
                this.customIcons,
                (updatedIcons: typeof this.customIcons) => {
                    console.debug(`Updated custom icons: ${updatedIcons}`);
                    this.customIcons = updatedIcons;
                    dynamicStyle.removeAllIcons();
                    this.customIcons.forEach(icon => {
                        dynamicStyle.addIcon(icon.href, icon.iconUrl, false);
                    });
                    dynamicStyle.flushStyle();
                    this.saveData(customIconsFile, this.customIcons);
                },
                () => {
                    dialog.destroy();
                }
            );
            const dialog = simpleDialog({
                title: this.i18n.manage,
                ele: ele,
                width: '400px',
            });

        });

        this.setting = new siyuan.Setting({
            width: '700px',
            height: '500px',
            confirmCallback: () => {
                this.config.InsertDocRefIcon = inputDocRef.checked;
                this.config.InsertDocLinkIcon = inputDocLink.checked;
                this.saveData(ConfigFile, this.config);
            }
        });
        this.setting.addItem({
            title: this.i18n.InputDocRef.title,
            description: this.i18n.InputDocRef.description,
            createActionElement: () => {
                inputDocRef.checked = this.config.InsertDocRefIcon;
                return inputDocRef;
            },
        });
        this.setting.addItem({
            title: this.i18n.InputDocLink.title,
            description: this.i18n.InputDocLink.description,
            createActionElement: () => {
                inputDocLink.checked = this.config.InsertDocLinkIcon;
                return inputDocLink;
            },
        });
        this.setting.addItem({
            title: this.i18n.upload,
            // description: '上传自定义的 svg 图标或图片文件',
            createActionElement: () => {
                return uploadBtn;
            }
        });
        this.setting.addItem({
            title: this.i18n.manage,
            // description: '查看并管理所有自定义的图标',
            createActionElement: () => {
                return manageBtn;
            }
        });
    }

    private onCustomIconUpload(href: string, iconUrl: string) {
        console.debug(`Upload custom icon: ${href} -> ${iconUrl}`);
        dynamicStyle.addIcon(href, iconUrl);
        this.customIcons.push({ href, iconUrl });
        this.saveData(customIconsFile, this.customIcons);
        // Assume it is implemented by others
        // No need to complete this function
    }

    async listeners(event: TEventLoadedProtyle) {
        // 仅给触发加载文档的元素添加块引用图标
        let doc = event.detail?.protyle?.element;

        if (!doc) {
            console.warn("Listener failed to get protyle element");
            return;
        }

        if (this.config.InsertDocRefIcon) {
            let ref_list = doc.querySelectorAll("span[data-type='block-ref']");
            ref_list.forEach(async (element) => {
                let block_id = element.attributes["data-id"].value;
                this.insertDocIconBefore(element, block_id);
            });
        }

        if (this.config.InsertDocLinkIcon) {
            let url_list = doc.querySelectorAll("span[data-type=a][data-href^=siyuan]");
            url_list.forEach(async (element) => {
                let data_href = element.attributes["data-href"].value;
                const pattern = new RegExp("siyuan:\\/\\/blocks\\/(.*)");
                const result = data_href.match(pattern);
                if (result) {
                    const block_id = result[1];
                    this.insertDocIconBefore(element, block_id);
                }
            });
        }
    }

    /**
     * 
     * @param {HTMLSpanElement} element Span element
     */
    async insertDocIconBefore(element, block_id) {
        let previes_sibling = element.previousElementSibling;
        //如果前面的 span 元素是我们自定义插入的 icon, 就直接退出不管
        //不过实测由于思源会把自定义的 class 删掉, 所以这行逻辑没啥卵用...
        if (previes_sibling !== null && previes_sibling?.classList?.contains(ICON_CLASS)) {
            return false;
        }
        let previous_txt = previes_sibling?.innerText;
        if (isUnicodeEmoji(previous_txt)) {
            return true;
        }

        // let block_id = element.attributes["data-id"].value;
        let result = await queryDocIcon(block_id);
        if (result === null) {
            return false;
        }
        //思源有可能把 icon 的 span 元素保留了下来, 所以如果发现前面的 element 就是 icon, 就不需要再次插入
        if (result.type === 'unicode' && result.code === previous_txt?.trim()) {
            previes_sibling.classList.add(ICON_CLASS);
            return true;
        }
        element.insertAdjacentHTML('beforebegin', result.dom);
        return true;
    }
}
