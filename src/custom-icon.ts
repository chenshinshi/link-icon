/*
 * Copyright (c) 2024 by frostime. All Rights Reserved.
 * @Author       : frostime
 * @Date         : 2024-09-14 19:10:09
 * @FilePath     : /src/custom-icon.ts
 * @LastEditTime : 2024-10-09 16:44:07
 * @Description  : 
 */
import { showMessage, type Plugin } from 'siyuan';
type Href = string;
type IconUrl = string;
type CSSCode = string;

/**************************
 * @returns 动态样式相关函数
 *   - addIcon(href: Href, url: IconUrl): void; // 添加图标
 *   - removeIcon(href: Href): void; // 移除图标
 *   - clearStyle(id: string): void; // 清除样式
 **************************/
export const useDynamicStyle = (styleId = 'custom-icon-style') => {
    /**
     * 创建 CSS 样式模板
     * @param href 链接地址
     * @param url 图标 URL
     * @returns 返回生成的 CSS 规则
     */
    const template = (href: Href, url: IconUrl) => `
.protyle-wysiwyg [data-node-id] span[data-type~='a'][data-href *="${href}"]:not(:empty)::before,
.protyle-wysiwyg [data-node-id] span[data-type~='url'][data-href *="${href}"]:not(:empty)::before,
.protyle-wysiwyg [data-node-id] a[href *="${href}"]::before,
.b3-typography a[href *="${href}"]::before{
    content: "";
    background-image: url('${url}');
}
` as CSSCode;

    let customStyles: Record<Href, CSSCode> = {};

    /**
     * 更新样式
     * @param css 样式内容
     */
    const _updateStyle = (css: string) => {
        const element = document.getElementById(styleId);
        if (element) {
            element.innerHTML = css;
        } else {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = css;
            document.head.appendChild(style);
        }
    };

    /**
     * 清除样式
     */
    const clearStyle = () => {
        const element = document.getElementById(styleId);
        if (element) {
            element.remove();
        }
    }

    /**
     * 更新图标样式
     */
    const _flushStyle = () => {
        let css = '';
        for (const href in customStyles) {
            const style = customStyles[href];
            css += style + '\n';
        }
        _updateStyle(css);
    }

    /**
     * 添加图标
     * @param href 链接地址
     * @param url 图标 URL
     */
    const addIcon = (href: Href, url: IconUrl, flushStyle = true) => {
        const style = template(href, url);
        customStyles[href] = style;
        // updateIconStyle();
        if (flushStyle) {
            _flushStyle();
        }
    }

    const removeAllIcons = () => {
        customStyles = {};
    }

    /**
     * 移除图标
     * @param href 链接地址
     */
    const removeIcon = (href: Href) => {
        if (customStyles[href]) {
            delete customStyles[href];
            _flushStyle();
        }
    }

    return {
        addIcon,
        removeAllIcons,
        clearStyle,
        flushStyle: _flushStyle,
    }
}

const createForm = (path: string, isDir: boolean, file: Blob | any, stream?: boolean) => {
    let form = new FormData();
    form.append('path', path);
    form.append('isDir', isDir.toString());
    form.append('modTime', Math.floor(Date.now() / 1000).toString());
    if (file instanceof Blob && !stream) {
        form.append('file', file);
    } else {
        form.append('file', new Blob([file], { type: 'application/octet-stream' }));
    }

    return form;
}

const doUpload = async (file: File): Promise<IconUrl> => {
    const filename = file.name;
    let iconPath = `/data/public/custom-link-icons/${filename}`;
    const form = createForm(iconPath, false, file);
    let url = '/api/file/putFile';
    await fetch(url, {
        method: 'POST',
        body: form
    });
    return `/public/custom-link-icons/${filename}`;
}

/**
 * 上传自定义图标的界面
 */
export const uploadCustomIcon = (uploadCallback: (hrefName: Href, url: IconUrl) => void): HTMLElement => {
    const div = document.createElement('div');
    div.className = 'custom-icon-upload';
    div.innerHTML = `
        <h3>Upload Custom Icon</h3>
        <div class="input-group">
            <label for="website-href">Website URL:</label>
            <input type="text" id="website-href" placeholder="e.g., example.com">
        </div>
        <div class="input-group">
            <label for="icon-file">Select Icon:</label>
            <input type="file" id="icon-file" accept=".png,.jpg,.svg,.ico">
        </div>
        <div id="file-preview"></div>
        <button id="upload-button" class="b3-button" disabled>Upload Icon</button>
    `;

    const hrefInput = div.querySelector('#website-href') as HTMLInputElement;
    const fileInput = div.querySelector('#icon-file') as HTMLInputElement;
    const filePreview = div.querySelector('#file-preview') as HTMLDivElement;
    const uploadButton = div.querySelector('#upload-button') as HTMLButtonElement;

    const updateUploadButtonState = () => {
        uploadButton.disabled = !(hrefInput.value.trim() && fileInput.files && fileInput.files.length > 0);
    };

    hrefInput.addEventListener('input', updateUploadButtonState);
    fileInput.addEventListener('change', () => {
        updateUploadButtonState();
        filePreview.innerHTML = '';
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.style.maxWidth = '100px';
                img.style.maxHeight = '100px';
                filePreview.appendChild(img);
            } else {
                filePreview.textContent = `File selected: ${file.name}`;
            }
        }
    });

    uploadButton.addEventListener('click', async () => {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            try {
                const iconUrl = await doUpload(file);
                uploadCallback(hrefInput.value.trim(), iconUrl);
                showMessage('Icon uploaded successfully!');
                hrefInput.value = '';
                fileInput.value = '';
                filePreview.innerHTML = '';
                updateUploadButtonState();
            } catch (error) {
                console.error('Upload failed:', error);
                showMessage('Upload failed. Please try again.');
            }
        }
    });

    return div;
};


export const manageCustomIcons = (
    customIcons: { href: string; iconUrl: string }[],
    updatedCustomIcons: (customIcons: { href: string; iconUrl: string }[]) => void,
    closeCallback: () => void
): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'custom-icon-manager';

    customIcons = [...customIcons];

    Object.assign(container.style, {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '0 20px',
        gap: '15px',
    });

    const deleteList: string[] = [];

    const createIconElement = (icon: { href: string; iconUrl: string }, index: number) => {
        const iconElement = document.createElement('div');
        iconElement.className = 'custom-icon-item';
        Object.assign(iconElement.style, {
            display: 'flex',
            gap: '15px',
            // marginBottom: '10px',
            alignItems: 'center',
        });
        iconElement.innerHTML = `
            <img src="${icon.iconUrl}" alt="Custom Icon" class="custom-icon-preview" style="height: 25px;">
            <input type="text" class="custom-icon-href" value="${icon.href}" style="flex: 1;">
            <button class="custom-icon-delete b3-button b3-button--outline">Delete</button>
        `;

        const hrefInput = iconElement.querySelector('.custom-icon-href') as HTMLInputElement;
        const deleteButton = iconElement.querySelector('.custom-icon-delete') as HTMLButtonElement;

        hrefInput.addEventListener('change', () => {
            customIcons[index].href = hrefInput.value;
            // updatedCustomIcons([...customIcons]);
        });

        deleteButton.addEventListener('click', () => {
            const icon = customIcons[index];
            deleteList.push(icon.iconUrl);
            customIcons.splice(index, 1);
            iconElement.remove();
            // updatedCustomIcons([...customIcons]);
        });

        return iconElement;
    };

    const renderIcons = () => {
        container.innerHTML = '';
        customIcons.forEach((icon, index) => {
            container.appendChild(createIconElement(icon, index));
        });
    };

    renderIcons();

    const saveButton = document.createElement('button');
    saveButton.className = 'b3-button b3-button--text';
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', async () => {
        updatedCustomIcons([...customIcons]);
        let deleteTasks = [];
        for (const iconUrl of deleteList) {
            deleteTasks.push(fetch('/api/file/removeFile', {
                method: 'POST',
                body: JSON.stringify({
                    path: `/data${iconUrl}`
                })
            }));
        }
        await Promise.all(deleteTasks);
        closeCallback();
        showMessage('Custom icons updated successfully!');
    });

    container.appendChild(saveButton);

    return container;
};
