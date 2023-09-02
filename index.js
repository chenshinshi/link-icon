"use strict";
const siyuan = require("siyuan");

async function getDocIcon(block_id) {
    let response = await siyuan.fetchSyncPost(
        '/api/block/getDocInfo', 
        {
            id: block_id
        }
    )
    let icon_code = response.code === 200 ? null : response.data.icon
    // 这里可以考虑参考目录插件，插入文档默认的图标
    let block_icon = icon_code 
        ? String.fromCodePoint(parseInt(icon_code, 16))
        : ""
    return block_icon;
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
