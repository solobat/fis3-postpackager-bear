'use strict';
var Combo = require('./lib/combo');

module.exports = function (ret, conf, settings, opt) {
    // ret.src 所有的源码，结构是 {'<subpath>': <File 对象>}
    // ret.ids 所有源码列表，结构是 {'<id>': <File 对象>}
    // ret.map 如果是 spriter、postpackager 这时候已经能得到打包结果了，可以修改静态资源列表或者其他
    // settings 调用插件时传入的配置
    var path = require('path')
    var root = fis.project.getProjectPath();
    var fs = require('fs');
    var _ = fis.util;
    var ns = fis.get('namespace');
    var mapContent = ret.map;
    var uriPre = fis.get('bearStatics');
    uriPre = uriPre + (fis.get('projName') ? '/' + fis.get('projName') : '');
    console.info(uriPre);
    var regUriPre = new RegExp('^' + uriPre);

    //根据配置，
    // 如果是pubType=pubvm时，移除 /page / 下面所有的配置
    // 如果是pubType=pubpage时，移除非 /page / 下面所有的配置
    if (settings && settings['pubType']) {
        console.info(settings);
        var pubType = settings['pubType'];
        var uriPre = settings['uriPre'];
        // var mapContent = _.cloneDeep(mapContent);
        var res = mapContent['res'];
        switch (pubType) {
            case 'pubvm':
                for (var k in res) {
                    var propObj = res[k];
                    if (propObj['extras'] && propObj['extras']['isPage']) {
                        //如果是页面类型，移除
                        delete res[k];
                    } else {
                        var uri = propObj['uri'];
                        uri = uri.replace(regUriPre, '');
                        propObj['uri'] = uri;
                    }
                }
                mapContent = res;
                break;
            case 'pubpage':
                for (var k in res) {
                    var propObj = res[k];
                    if (!propObj['extras'] || !propObj['extras']['isPage']) {
                        //如果不是页面类型，移除
                        delete res[k];
                    }
                }

                break;
            default:
                break;
        }
    }

    var mapFile = ns ? (ns + '-map.json') : 'map.json';
    var map = fis.file.wrap(path.join(root, mapFile));
    map.setContent(JSON.stringify(mapContent, null, map.optimizer ? null : 4));
    ret.pkg[map.subpath] = map;


    var files = ret.src;
    var combSettings = settings['comb'];
    var combo = new Combo(combSettings);

    // comb 处理
    Object.keys(files).forEach(function (subpath) {
        var file = files[subpath];
        var isPage = false;
        if (file.isHtmlLike) {
            var fileId = file.id;
            var content = file.getContent();
            var globalStaticConf = {
                arrGlobalJs: [],
                arrGlobalCss: []
            };

            if (/^page\/(.*?)\.vm$/.test(fileId)) {
                var regLayout = /#extends\(("|')(\/?page\/layout\/.*?)\.vm\1\)/;
                var match = content.match(regLayout);
                if (match) {
                    var layoutFileId = match[2];
                }
                if (layoutFileId) {
                    isPage = true;
                    // get layout_xx.conf.json
                    var layoutConfFilePath = path.join(root, layoutFileId + '.conf.json');
                    var json = fs.readFileSync(layoutConfFilePath, 'utf8');
                    var layoutConf = JSON.parse(json);
                    globalStaticConf = {
                        arrGlobalJs: layoutConf['arrGlobalJs'],
                        arrGlobalCss: layoutConf['arrGlobalCss']
                    };
                }
            }

            var conf = {
                isPage: isPage,
                fileId: fileId,
                map: ret.map['res'],
                globalStaticConf: globalStaticConf
            };

            content = combo.process(content, conf);
            file.setContent(content);
        }
    });

}
