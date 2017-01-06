/*
 * Copyright (c) 2015 xsbchen
 * Licensed under the MIT license.
 */

'use strict';

var extend = require('extend');
var url = require('url');

Array.prototype.pushUnique = Array.prototype.pushUnique || function (item) {
    if (this.indexOf(item) == -1) {
        this.push(item);
        return true;
    }
    return false;
}

var arrayMerge = function(arr1, arr2){
    for (var i = 0, len = arr2.length; i < len; i++){
        arr1.pushUnique(arr2[ i ]);
    }

    return arr1;
}


var templates = {
    script: '<script $attributes$ src="$src$"></script>',
    link: '<link $attributes$ href="$src$"/>'
};

var placeholderMap = {
    script: '__$COMB_JS$__',
    link: '__$COMB_CSS$__'
};

var combKey = {
    script: 'arrCombJs',
    link: 'arrCombCss'
};

/**
 * 模板解释
 * @param {String} tmpl 模板字符串
 * @param {Object} paramObj 数据
 * @return {String} 返回解释后的字符串
 */
function parseTmpl(tmpl, paramObj) {
    paramObj = paramObj || paramObj;

    if (typeof tmpl === 'string') {
        return tmpl.replace(/\$([_a-zA-Z0-9]*)\$/g, function (m, n) {
            return typeof paramObj[n] === 'undefined' ? '' : paramObj[n];
        });
    } else {
        return tmpl;
    }
}

/**
 * 解释属性字符串
 * @param {String} attrStr 属性字符串
 * @returns {Object} 属性对象
 */
function parseAttributes(attrStr) {
    var reAttributes = /([^=<>\"\'\s]+)\s*(?:=\s*["']?([^"']*)["']?)?/g;
    var result = {};
    var match;

    if (attrStr) {
        while (match = reAttributes.exec(attrStr)) {
            result[match[1]] = match[2] || true;
        }
    }

    return result;
}

Combo.prototype._getComboUrl = function (arrRes) {

    var pubType = this.options['pubType'];
    var isPubvm = pubType === 'pubvm';
    var comboUrl = '';
    // console.info('_getComboUrl,pubType:%s,arrRes:%s', pubType,arrRes);
    if (isPubvm) {
        var arr = [], arrVersionKey = [];
        var regUrl = /^(\/static)(\/(.*?)\/.*?\/)(.*?)(\.(?:css|js))/;
        // /static/widget/header/header.css ==> match result: ["/static/widget/header/header.css", "/static", "/widget/header/", "widget", "header", ".css"]
        // /static/css/normalize/normalize.css ==> match result: ["/static/css/normalize/normalize.css", "/static", "/css/normalize/", "css", "normalize", ".css"]
        arrRes.forEach(function (res) {
            var mRes = res.match(regUrl);
            var url, versionKey, versionStr;
            if(mRes !== null) {
                versionKey = mRes[1] + mRes[2] + (mRes[3] === 'widget' ? mRes[4] + '.vm' : mRes[4] + mRes[5]);
                versionStr = "$resVersion['" + versionKey + "']";
                url = mRes[2] + versionStr + '/' + mRes[4] + mRes[5];
                arr.push(url);
            }else {
                console.error('url[%s] not match 规则 %s!', res, regUrl);
                return;
            }
        });
        comboUrl = arr.join(this.options.separator);
    } else {
        comboUrl = arrRes.join(this.options.separator);
    }

    // console.info('comboUrl:%s', comboUrl);
    return comboUrl;
}

/**
 * 获取匹配指定正则表达式的TAG列表
 * @param {String} rawHtml 待匹配的HTML源
 * @param {Regexp} reTag 指定的正则表达式
 * @returns {Array} 匹配的TAG列表
 */
function getTags(rawHtml, reTag) {
    var result = [];
    var match, attributes;

    while (match = reTag.exec(rawHtml)) {
        attributes = parseAttributes(match[2] || '');

        result.push({ name: match[1], attributes: attributes, raw: match[0] });
    }

    return result;
}

/**
 * 分组
 * @param {Array} tags TAG列表
 * @param {String} key
 * @returns {Object}
 */
function groupTags(tags, key) {
    var groupBy = 'data-combo';
    return tags.reduce(function (previous, current) {
        var combineName = current.attributes[groupBy];
        var keyValue = current.attributes[key];

        if (!keyValue || !combineName) {
            return previous;
        }

        var group = previous[combineName];

        if (!group) {
            group = previous[combineName] = [];
        }

        delete current.attributes[groupBy];
        group.push(current);

        return previous;
    }, {});
};

/**
 * Combo Class
 * @param options
 * @constructor
 */
function Combo(options) {
    this.options = extend({
        basePath: '/c/=',
        separator: ',',
        selectors: {
            script: /<(script)([^>]*)>((?:.|\r\n)*?)<\/script>/g,
            link: /<(link)([^>]*?)\/?>/g
        }
    }, options);
}

/**
 * 生成合并TAG
 * @param type
 * @param files
 * @param attributes
 * @returns {String}
 * @private
 */
Combo.prototype._generateCombinedTag = function _generateCombinedTag(type, files, attributes) {
    // debugger;
    if (!files.length) {
        return '';
    }
    var attrStr = [];
    var filesMaxIdx = files.length - 1;

    attributes = extend(true, {}, attributes);
    delete attributes.src;
    delete attributes.href;

    var arrFiles = [];
    if (filesMaxIdx === 0) {
        // files[0] = files[0].split('?')[0];
        arrFiles.push(files[0]);
    } else {
        // var combineUrlTmpl = '//$host$' + this.options.basePath  + '$pathname$';
        // files = files.map(function(file, idx) {
        //   if (file.indexOf('//') === 0) {
        //     file = 'http:' + file;
        //   }

        //   var urlParts = url.parse(file);

        //   if (idx === 0) {
        //     return parseTmpl(combineUrlTmpl, urlParts);
        //   }

        //   return urlParts.pathname;
        // });

        files.forEach(function (file, idx) {
            if (file.indexOf('//') === 0 || file.indexOf('http') === 0) {
                return;
            }
            arrFiles.push(file);
        });
    }

    for (var attrName in attributes) {
        attrStr.push(attrName + '="' + attributes[attrName] + '"');
    }

    // var url = this.options.combUrlPre + arrFiles.join(this.options.separator);
    var url = this.options.combUrlPre + this._getComboUrl(arrFiles);

    // return parseTmpl(templates[type], { src: encodeURI(url), attributes: attrStr.join(' ') });
    return parseTmpl(templates[type], { src: url, attributes: attrStr.join(' ') });
};

/**
 * 处理TAGS
 * @param rawHtml
 * @param type
 * @param key
 * @returns {*}
 * @private
 */
Combo.prototype._processTags = function _processTags(rawHtml, type, key) {
    var allMatchTags = getTags(rawHtml, this.options.selectors[type]);
    var tagsGroup = groupTags(allMatchTags, key);
    var placeholder = '__$COMBINE$__';
    var arrCombFiles = [];

    for (var combineName in tagsGroup) {
        var tags = tagsGroup[combineName];
        var tagsMaxIdx = tags.length - 1;
        var files = [];
        var attributes = {};

        tags.forEach(function (tag, idx) {
            files.push(tag.attributes[key]);
            extend(attributes, tag.attributes);

            rawHtml = rawHtml.replace(tag.raw, idx < tagsMaxIdx ? '' : placeholder);
        });

        rawHtml = rawHtml.replace(placeholder, this._generateCombinedTag(type, files, attributes));
        arrCombFiles = arrCombFiles.concat(files);
    }

    return {
        rawHtml: rawHtml,
        arrCombFiles: arrCombFiles
    };
};

Combo.prototype._getWidgetDeps = function _getWidgetDeps(w, map, conf) {
    // console.info('_getWidgetDeps ...');
    var arrCombJs = [];
    var arrCombCss = [];
    var arrJsMod = [];
    // var arrWidgetConf = [];
    function buildDeps(arrDeps) {
        arrDeps.forEach(function (deps) {
            var depsId = deps, vmPath;

            var depsObj = map[depsId];
            if (!depsObj) {
                console.error('%s is not in map!!', depsId);
                return;
            }
            var hisDeps = depsObj['deps'] || [];
            if (hisDeps && hisDeps.length) {
                buildDeps(hisDeps);
            }

            var type = depsObj.type;
            var uri = depsObj.uri;

            switch (type) {
                case 'vm':

                    // 检查deps中的js，添加到arrJsMod里
                    // arrJsMod中只放每一个vm同名依赖的js模块，它的依赖已经打包在arrCombJs中提前加载了
                    var depsIdPre = depsId.replace(/(.*?)(\.vm)$/, '$1');
                    hisDeps.map(function (item) {
                        if (item === depsIdPre + '.js') {
                            var modId = map[item] && map[item]['extras']['moduleId'];
                            arrJsMod.push({
                                moduleId: '"' + modId + '"',
                                widgetId: deps.idf
                            });
                        }
                    });

                    break;
                case 'js':
                    if (!~conf['arrGlobalJs'].indexOf(uri)) {
                        arrCombJs.pushUnique(uri);
                    }
                    break;
                case 'css':
                    if (!~conf['arrGlobalCss'].indexOf(uri)) {
                        arrCombCss.pushUnique(uri);
                    }
                    break;
                default:
                    break;
            } //end of switch
        }); //end of forEach

    }

    if (!Array.isArray(w)) {
        w = [w];
    }
    buildDeps(w);
    return {
        arrCombCss: arrCombCss,
        arrCombJs: arrCombJs,
        arrJsMod: arrJsMod,
        // arrWidgetConf: arrWidgetConf
    };

}
Combo.prototype._processDeps = function (fileId, map, globalConf) {
    if (!map[fileId]) {
        return {
             arrCombCss: [],
            arrCombJs: [],
            arrJsMod: []
        }
    };
    var deps = map[fileId]['deps'] || [];
    var depRes = this._getWidgetDeps(deps, map, globalConf);
    return depRes;
}

Combo.prototype._processByDeps = function (rawHtml, deps) {
    var _this = this;
    ['script', 'link'].forEach(function (type) {
        var placeholder = placeholderMap[type];
        var key = combKey[type];
        var files = deps[key];
        var attributes = type === 'link' ? {
            rel: 'stylesheet'
        } : {};

        rawHtml = rawHtml.replace(placeholder, _this._generateCombinedTag(type, files, attributes));
    });


    return rawHtml;
}

Combo.prototype._processByTag = function _processTags(rawHtml, deps, type, key) {
    var ret = this._processTags(rawHtml, type, key);
    return ret;
}

/**
 * 处理内容
 * @param content
 * @returns {*}
 */
Combo.prototype.process = function combine(content, conf) {
    var fileId = conf['fileId'];
    // console.info('handle：', fileId);
    var map = conf['map'];
    var globalConf = conf['globalStaticConf'];
    var isPage = conf['isPage'];
    var deps = this._processDeps(fileId, map, globalConf);

    if (isPage) {
        content = this._processByDeps(content, deps);
    } else {
        var ret = this._processByTag(content, deps['arrCombJs'], 'script', 'src');
        content = ret['rawHtml'];
        if (ret['arrCombFiles'].length) {
            // console.info('%s:\n combScirpt:', fileId, ret['arrCombFiles']);
        }

        ret = this._processByTag(content, deps['arrCombCss'], 'link', 'href');
        content = ret['rawHtml'];
        if (ret['arrCombFiles'].length) {
            // console.info('%s:\n combCss:', fileId, ret['arrCombFiles']);
        }
    }

    return content;
};

module.exports = Combo;
