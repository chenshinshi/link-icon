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
        let code =  sub_file_cnt > 0 ? '📑' : '📄';
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
    if (icon_code.toLowerCase().endsWith(".svg")) {
        result.type = "svg";
        result.dom = `<img alt="${icon_code}" class="emoji ${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}">`
    } else {
        result.type = "unicode";
        result.code = String.fromCodePoint(parseInt(icon_code, 16))
        result.dom = `<span data-type="text" class="${ICON_CLASS}">${result.code}</span>`
    }

    return result;
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
            let previes_sibling = element.previousElementSibling;
            if (previes_sibling !== null && previes_sibling?.classList?.contains(ICON_CLASS)) {
                continue;
            }
            let previous_txt = previes_sibling?.textContent;

            let block_id = element.attributes["data-id"].value;
            let result = await getDocIconDom(block_id);
            if (result === null) {
                continue;
            }
            //Type 1. 思源有可能把之前的 unicode 识别为锚文本的一部分
            if (element.innerHTML.startsWith(result.code)) {
                element.innerHTML = element.innerHTML.substring(result.code.length);
            }
            //Type 2. 思源还有可能把 icon 的 span 元素保留了下来
            if (result.type === 'unicode' && result.code === previous_txt?.trim()) {
                previes_sibling.classList.add(ICON_CLASS);
                continue;
            }
            element.insertAdjacentHTML('beforebegin', result.dom);
        }
        let url_list = doc.querySelectorAll("span[data-type=a][data-href^=siyuan]");
        [].forEach.call(url_list, async (element)=>{
            let previes_sibling = element.previousSibling;
            if (previes_sibling !== null && previes_sibling?.classList?.contains(ICON_CLASS)) {
                return;
            }
            let data_href = element.attributes["data-href"].value;
            const pattern = new RegExp("siyuan:\\/\\/blocks\\/(.*)");
            const result = data_href.match(pattern);

            if (result) {
                const block_id = result[1];
                let block_icon = await getDocIconDom(block_id);
                if (block_icon === null) {
                    return;
                }
                element.insertAdjacentHTML('beforebegin', block_icon);
            }
        });
    }
}

module.exports = LinkIconPlugin;
