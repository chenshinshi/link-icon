"use strict";
const siyuan = require("siyuan");

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

async function getDocIcon(block_id) {
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

    //@string
    let icon_code = response.data.icon;
    let sub_file_cnt = response.data.subFileCount;
    if (icon_code === "") {
        return sub_file_cnt > 0 ? "📑" : "📄";
    }

    let icon = "";
    if (icon_code.toLowerCase().endsWith(".svg")) {
        // icon = `<img alt="${icon_code} class="emoji" src="/emojis/${icon_code}" title="${icon_code}">`
        icon = ""
    } else {
        icon = String.fromCodePoint(parseInt(icon_code, 16))
    }

    return icon;
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
            let block_id = element.attributes["data-id"].value;
            let block_icon = await getDocIcon(block_id);
            if (block_icon === null) {
                continue;
            }
            let html = element.innerHTML;
            element.innerHTML = html.startsWith(block_icon) ? html : block_icon + html;
        }
    }
}

module.exports = LinkIconPlugin;
