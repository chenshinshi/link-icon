"use strict";
const siyuan = require("siyuan");

async function getDocIcon(block_id) {
    let response = await siyuan.fetchSyncPost(
        '/api/block/getDocInfo', 
        {
            id: block_id
        }
    );
    if (response.code !== 0) {
        return "";
    }

    let icon_code = response.data.icon;;
    let sub_file_cnt = response.data.subFileCount;
    if (icon_code === "") {
        return sub_file_cnt > 0 ? "📑" : "📄";
    }

    return String.fromCodePoint(parseInt(icon_code, 16));;
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
            let html = element.innerHTML;
            element.innerHTML = html.startsWith(block_icon) ? html : block_icon + html;
        }
    }
}

module.exports = LinkIconPlugin;
