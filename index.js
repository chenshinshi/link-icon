"use strict";
const siyuan = require("siyuan");

const ICON_CLASS = "plugin-link-icon";

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
 * @returns icon_dom
 *    - null: 不是文档块
 *    - <img class="plugin-link-icon" />: svg 图标
 *    - <span class="plugin-link-icon" />: emoji 图标
 */
async function getDocIconDom(block_id) {
    //如果不是文档块，则不添加图标
    let blocks = await sql(`select * from blocks where id = "${block_id}"`);
    if (blocks?.[0] === null || blocks[0].type !== 'd') {
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
        return sub_file_cnt > 0
            ? `<span class="${ICON_CLASS}">📑</span>`
            : `<span class="${ICON_CLASS}">📄</span>`;
    }

    let icon_dom = "";
    //使用了自定义的 svg 图标 vs 使用 unicode 编码的 emoji
    if (icon_code.toLowerCase().endsWith(".svg")) {
        icon_dom = `<img alt="${icon_code}" class="emoji ${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}">`
    } else {
        icon_dom = String.fromCodePoint(parseInt(icon_code, 16))
        icon_dom = `<span class="${ICON_CLASS}">${icon_dom}</span>`
    }

    return icon_dom;
}


class LinkIconPlugin extends siyuan.Plugin{
    async onload() {
        this.eventBus.on('loaded-protyle', this.listeners)
    }

    async unload() {
        this.eventBus.off('loaded-protyle', this.listeners)
    }

    async listeners(event) {
        // 仅给触发加载文档的元素添加块引用图标
        let doc = event.detail.element;
        let ref_list = doc.querySelectorAll("span[data-type='block-ref']")

        for (let index = 0; index < ref_list.length; index++) {
            let element = ref_list[index];

            // 如果前一个元素是图标，则不再添加
            let previes_sibling = element.previousSibling;
            if (previes_sibling !== null && previes_sibling?.classList?.contains(ICON_CLASS)) {
                continue;
            }

            let block_id = element.attributes["data-id"].value;
            let block_icon = await getDocIconDom(block_id);
            if (block_icon === null) {
                continue;
            }
            element.insertAdjacentHTML('beforebegin', block_icon);
        }
    }
}

module.exports = LinkIconPlugin;
