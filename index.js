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
async function queryDocIcon(block_id) {
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

function isUnicodeEmoji(text) {
    const regex = /\p{Emoji}/u;
    return regex.test(text);
}

class LinkIconPlugin extends siyuan.Plugin{

    Listener = this.listeners.bind(this);

    async onload() {
        this.eventBus.on('loaded-protyle', this.Listener)
    }

    async unload() {
        this.eventBus.off('loaded-protyle', this.Listener)
    }

    async listeners(event) {
        // 仅给触发加载文档的元素添加块引用图标
        let doc = event.detail.element;
        let ref_list = doc.querySelectorAll("span[data-type='block-ref']");
        ref_list.forEach(async (element) => {
            let block_id = element.attributes["data-id"].value;
            this.insertDocIconBefore(element, block_id);
        });

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

module.exports = LinkIconPlugin;
