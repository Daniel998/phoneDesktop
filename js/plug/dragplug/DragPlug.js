/*
 * @Author: xhj
 * @Email:505710955@qq.com
 * @Date:   2018-05-20 11:00:08
 * @Last Modified by:   xhj
 * @Content:封装插件（封装华为plug6 桌面文件管理的功能），完成需要参数
 * @Last Modified time: 2018-05-21 20:30:05
 * @Content:完成页面初化化逻辑
 * @Last Modified time: 2018-05-22 20:20:08
 * @Content:完成移动文件合并逻辑功能
 * @Last Modified time: 2018-05-23 19:22:29
 * @Content:完成移动文件到文件夹功能
 * @Last Modified time: 2018-05-24 22:22:29
 * @Content:完成弹出文件夹并且将文件移动替换位置的功能
 * @Last Modified time: 2018-05-25 23:14:29
 * @Content:插件功能测试，大体完成功能，但是代码多后的调试比较吃力，希望有时间可以二次封装代码
 */

//root根作用域  工厂函数   plug 插件名称 target 目标控件
(function (root, factory, plug) {
    factory(root.jQuery, plug);
})(window, function (jquery, plug) {

    this.longClick = false;//是否在长按

    this.timeOutEvent = null;//长度事件的id

    //配置默认参数
    var _DEFAULTS_ = {
        initEvent: "touchend",
        col: 3,          // 3 列布局
        width: "80%",  //格子的宽度,如果传入并且小于平均的宽度则取传入的宽度进行每一项的布局，如果
        //传入并且大于平均每一项的布局宽度，则取平均值99%（1%为间隔）
        row: 4,          //一屏有多少行，用于计算高度
        height: "100%", //每一项的高度，超出100%以100%计算，低于100% 以传入值进行处理
        borderRadius: "5%", //圆角效果处理
        data: [{name: "", img: ""}],//必须传入值，如果不传入则不生成格子
        pageHeight: "20%",
        imageHeight: "80%",
        fontSize: "",
        plugName: "drag"
    };


    $.fn[plug] = function (options) {
        this.doMessage = "";
        //给到this对象   以默认为优先 以用于自定义配置为覆盖
        $.extend(this, _DEFAULTS_, options);

        var _self = this;

        this.longClickTimeOut = 1000;

        this.isDoingRemoveFoldItem = false;//正在删除文件夹中的文件

        /****
         * 计算重叠面积
         * @param left 是移动的div 的left
         * @param top
         * @param wrapLeft 包裹层的left
         * @param wrapTop 是包裹层的top
         * @returns {number}
         */
        this.getOverArea = function (left, top, wrapLeft, wrapTop) {
            var difX = 0;
            var difY = 0;

            if (left < wrapLeft) {
                difX = left + _self.customWidth - wrapLeft;
            }
            else {
                difX = wrapLeft + _self.customWidth - left;
            }
            if (top < wrapTop) {
                difY = top + _self.customHeight - wrapTop;
            }
            else {
                difY = wrapTop + _self.customHeight - top;
            }

            return difX * difY;
        };

        /***
         * 弹出的子窗口移动时计算重叠面积
         * @param left
         * @param top
         * @param wrapLeft
         * @param wrapTop
         * @returns {number}
         */
        this.getOverFoldWrapArea = function (left, top, wrapLeft, wrapTop) {
            var difX = 0;
            var difY = 0;

            _self.customFoldWrapWidth = _self.customFoldWrapWidth || $(_self.lastMoveDivItem).width();
            _self.customFoldWrapHeight = _self.customFoldWrapHeight || $(_self.lastMoveDivItem).height();

            var minLeft = wrapLeft - _self.customFoldWrapWidth;
            var minTop = wrapTop - _self.customFoldWrapHeight;
            var maxLeft = wrapLeft + _self.customFoldWrapWidth;
            var maxTop = wrapTop + _self.customFoldWrapHeight;
            if (minLeft <= left && left <= maxLeft && minTop <= top && top <= maxTop) {
                if (left < wrapLeft) {
                    difX = left + _self.customFoldWrapWidth - wrapLeft;
                }
                else {
                    difX = wrapLeft + _self.customFoldWrapWidth - left;
                }
                if (top < wrapTop) {
                    difY = top + _self.customFoldWrapHeight - wrapTop;
                }
                else {
                    difY = wrapTop + _self.customFoldWrapHeight - top;
                }
                return difX * difY;
            }
            else {
                return 0;
            }

        }

        /****
         * 根据位置找到当前文件项,
         * 如果移动的位置图标对应跨入了多个文件领空，以占入最大领空的那一项返回
         * @param left
         * @param top
         * @returns {*}
         */
        this.getWrapDomRangeByPosition = function (left, top) {

            //移动时进行文件项的临时数组，同时进入多个框时以进入面积大的为主
            var tempRange = new Array();

            for (var i = 0; i < _self.wrapItems.length; i++) {

                var wrapLeft = _self.wrapItems[i].position.left;
                var wrapTop = _self.wrapItems[i].position.top;

                var minLeft = wrapLeft - _self.customWidth;
                var minTop = wrapTop - _self.customHeight;
                var maxLeft = wrapLeft + _self.customWidth;
                var maxTop = wrapTop + _self.customHeight;

                if (minLeft <= left && left <= maxLeft && minTop <= top && top <= maxTop) {
                    tempRange.push(_self.wrapItems[i])
                    //return _self.wrapItems[i];
                }
            }

            if (tempRange.length > 0) {

                //只进入一个文件的领空
                if (tempRange.length == 1) {
                    return tempRange[0];
                }
                var maxArear = 0;
                var maxIndex = 0;
                for (var i = 0; i < tempRange.length; i++) {
                    var overArea = _self.getOverArea(left, top, tempRange[i].position.left, tempRange[i].position.top);

                    if (overArea >= maxArear) {
                        maxArear = overArea;
                        maxIndex = i;
                    }
                }
                //返回占用最大领空的文件项
                return tempRange[maxIndex];
            }
            return null;
        };

        /*****
         * 将格子移动到空格位置中
         * @param target
         */
        this.moveDataToSpace = function (target) {
            //格子还没有数据
            $(target).css({
                "top": _self.lastWrapItem.position.top,
                "left": _self.lastWrapItem.position.left,
                "width":_self.customWidth+"px",
                "height":_self.customHeight+"px"
            });
            //进行了跨页拖动，需要修改结构
            if (_self.beginPageTrun !== _self.currentPage) {
                $(".drag-panel-container > .data-div[data-page='" + _self.currentPage + "']").append($(target));
            }
            var targetId = _self.lastWrapItem.id;
            _self.wrapDataItems[targetId] = new Array();
            var eType = $(target).attr("data-type") || "data";
            var eId = $(target).attr("id");


            //将原来的位置给清除
            for (var entity in _self.wrapDataItems) {
                for (var i = 0; i < _self.wrapDataItems[entity].length; i++) {

                    if (_self.beginPageTrun !== _self.currentPage) {
                        if (_self.wrapDataItems[entity][i].page === _self.beginPageTrun
                            && _self.wrapDataItems[entity][i].id === eId
                        ) {
                            _self.wrapDataItems[entity].splice(i, 1);
                        }

                    }
                    else {
                        if (_self.wrapDataItems[entity][i].page === _self.currentPage
                            && _self.wrapDataItems[entity][i].id === eId
                        ) {
                            _self.wrapDataItems[entity].splice(i, 1);
                        }
                    }
                }
            }

            //将位置填入
            _self.wrapDataItems[targetId].push({"page": _self.currentPage, "type": eType, "id": eId});
            _self.locationData[eId].page = _self.currentPage;

            _self.locationData[eId].position = {
                "left": _self.lastWrapItem.position.left,
                "top": _self.lastWrapItem.position.top
            }
            $(".drag-panel-container").removeClass("page-border-right");

            $("#" + targetId).removeClass("ative");
        }

        /***
         * 跳转到哪一页面
         * @param pageIndex
         */
        this.turnToPage = function (pageIndex) {

            _self.pageTurning = true;

            $(_self).find(".drag-panel-container .data-div[data-page='" + pageIndex + "']").show()
                .siblings(".drag-panel-container .data-div").hide();

            _self.currentPage = parseInt(pageIndex);

            $(_self).find(".drag-panel-container .page-move-bg .drag-page span[data-page='" + pageIndex.toString() + "']")
                .addClass("ative").siblings().removeClass("ative");
        };

        /****
         * 文件夹中的数据
         * @param pageIndex
         */
        this.turnToFoldPage = function (pageIndex) {

            $("body .drag-enlarge-content .data-div[data-page='" + pageIndex + "'] ").show()
                .siblings(".drag-enlarge-content .data-div").hide();

            $("body .drag-enlarge-bg .drag-page span:nth-child(" + pageIndex.toString() + ")").addClass("ative")
                .siblings().removeClass("ative");

            _self.foldCurrentPage = pageIndex;
        };

        /****
         * 移动的时候又移动到了原来的那一页
         * @param $this
         */
        this.goBack = function ($this) {
            if (_self.isDoingRemoveFoldItem) {
                return;
            }
            if (_self.lastMoveDivItemIndex == 0) {
                var firstChild = $(".drag-panel-container .data-div[data-page='" + _self.beginPageTrun + "'] .data-item:first");
                $(_self.lastMoveDivItem).insertBefore($this);//原本在第一个元素，现在还是插入到第一个元素的位置
            }
            else {
                //原本的上一个节点
                var preBrother = $(".drag-panel-container  .data-div[data-page='" + _self.beginPageTrun + "'] .data-item:nth-child(" + (_self.lastMoveDivItemIndex) + ")");
                $(_self.lastMoveDivItem).insertAfter(preBrother);//原本在第一个元素，现在还是插入到第一个元素的位置
            }
        }

        /***
         * 屏幕滑动的方向
         * @param startX
         * @param startY
         * @param endX
         * @param endY
         * @returns {string}
         */
        this.getMoveDirection = function (startX, startY, endX, endY) {
            var dy = endY - startY;
            var dx = endX - startX;
            var absDy = Math.abs(dy);
            var absDx = Math.abs(dx);
            if (absDy > absDx && dy < 0 && absDy > 10) {
                return "up";
            }
            if (absDy > absDx && dy > 0 && absDy > 10) {
                return "down";
            }
            if (absDx > absDy && dx > 0 && absDx > 10) {
                return "right";
            }
            if (absDx > absDy && dx < 0 && absDx > 10) {
                return "left";
            }
            return "";
        };

        /***
         * 图标项的开始移动进行数据初始化
         * @param $this
         * @param e
         */
        this.dataItemTouchStart = function ($this, e) {
            var _$this = $($this);
            _self.startposition = _$this.position();
            var ev = e.originalEvent.touches[0];
            _self.disX = ev.pageX - _self.startposition.left;
            _self.disY = ev.pageY - _self.startposition.top;

            //通过位置来获取初始项
            var wrapItem = _self.getWrapDomRangeByPosition(_self.startposition.left, _self.startposition.top);
            _self.lastWrapItem = wrapItem;
            $(_self).find("#" + wrapItem.id).addClass("ative").siblings().removeClass("ative");//激活边框

            _self.lastMoveDivItemIndex = $($this).index();
            _self.currentPage = _self.currentPage || 1;
            _self.beginPageTrun = _self.currentPage;

            var html = _$this.html();
            $(".clone-move-item").html(html);
            $(".clone-move-item").css({
                "left": _self.startposition.left + "px",
                "top": _self.startposition.top + "px"
            }).show()
        };

        /****
         * 文件（图标项）移动过程中的逻辑
         * 1、如果是移动到一个空白位置，则将该文件放到空白位置处
         * 2、如果是移动到文件夹中则将该文件合并到文件夹中，将该文件放到最后一页的最后一个位置，如果最后
         *    一页已经满，则新增一页，再放在第一个位置
         * 3、如果是移动到一个文件中，则将移动文件与目标文件合并成一个文件夹
         * @param $this
         * @param e
         */
        this.dataItemTouchMove = function ($this, e) {
            var ev = e.type == 'touchmove' ? e.originalEvent.touches[0] : e,
                $this = $($this),
                $parent = $this.offsetParent();
            $parent = $parent.is(':root') ? $("body") : $parent;

            var pPos = $parent.offset();

            var pPos = pPos ? pPos : {left: 0, top: 0},
                left = ev.pageX - _self.disX - pPos.left,
                top = ev.pageY - _self.disY - pPos.top,
                r = $parent.width() - $this.outerWidth(true),
                d = $parent.height() - $this.outerHeight(true);

            left = left < 0 ? 0 : left > r ? r : left;
            top = top < 0 ? 0 : top > d ? d : top;

            $this.css({
                left: left + 'px',
                top: top + 'px',
                "z-index": 99999
            });
            $(".clone-move-item").css({
                left: left + 'px',
                top: top + 'px',
                "z-index": 99998
            }).show();

            var wrapItem = _self.getWrapDomRangeByPosition(left, top);
            if (wrapItem) {
                if (_self.lastWrapItem.id != wrapItem.id) {
                    $("#" + _self.lastWrapItem.id).removeClass("ative");//将原来已经激活的item 边框去掉
                    _self.lastWrapItem = wrapItem;
                    $("#" + wrapItem.id).addClass("ative");//激活边框
                }
            }
            else {
                //位置不在边框wrap中，将去掉所有的边框激活状态
                if (_self.lastWrapItem) {

                    $("#" + _self.lastWrapItem.id).removeClass("ative");//激活边框
                }
            }

            clearTimeout(_self.timeOutEvent);
            _self.timeOutEvent = 0;
            _self.longClick = false;

            if (left == 0 && _self.currentPage > 1) {
                $(".drag-panel-container").addClass("page-border-left");
                $(".drag-panel-container").removeClass("page-border-right");
            }
            else if (left + _self.customWidth >= $parent.width()) {
                $(".drag-panel-container").addClass("page-border-right");
                $(".drag-panel-container").removeClass("page-border-left");
            }
            else {
                $(".drag-panel-container").removeClass("page-border-left");
                $(".drag-panel-container").removeClass("page-border-right");
            }

            //坚持1s钟
            _self.timeOutEvent = setTimeout(function () {
                _self.longClick = true;

                console.log("left:", left, "_self.currentPage", _self.currentPage);
                console.log("left + _self.customWidth >= $parent.width():", left + _self.customWidth >= $parent.width());
                //向前翻页
                if (left <= 0 && _self.currentPage > 1) {

                    var prePage = _self.currentPage - 1;
                    _self.turnToPage(prePage);

                    //翻页回到了原始页位置
                    if (prePage === _self.beginPageTrun) {
                        _self.goBack();
                    }
                    /** else {
            //翻页到前面的一页

          }
                     **/
                }
                //向后翻页
                else if (left + _self.customWidth >= $parent.width()) {
                    _self.pageTurning = true;
                    var nextPage = _self.currentPage + 1;
                    //向后翻页
                    var $nextPageNode = $(".drag-panel-container .data-div[data-page=" + nextPage.toString() + "]");
                    //如果有后一页，则往后翻页
                    if ($nextPageNode && $nextPageNode.length > 0) {
                        _self.turnToPage(nextPage);

                    }
                    else {
                        //创建新一页
                        _self.moveAndCreateDataItemNewPage($this, nextPage);
                    }
                    //向后翻页时又翻回来到原始页
                    if (nextPage == _self.beginPageTrun) {
                        _self.goBack();
                    }


                }
            }, _self.longClickTimeOut);
        };

        /****
         * 创建新的文件夹，移动到了最后的一页后还需要往后移动就得创建新的一页
         * @param $this 当前移动的文件/文件夹
         */
        this.moveAndCreateDataItemNewPage = function ($this, pageIndex) {
            pageIndex = pageIndex || _self.currentPage + 1;
            $(".drag-panel-container .page-move-bg").before("<div class='data-div' data-page='" + pageIndex + "' style='display: none;'></div>");
            $(".drag-panel-container .page-move-bg .drag-page").append("<span data-page='" + pageIndex + "' class='ative'></div>");

            var nextPageNode = $(".drag-panel-container .data-div[data-page=" + pageIndex.toString() + "]");

            _self.turnToPage(pageIndex);
            $(nextPageNode).append($this);
            _self.totalPage++;
            if (!$this.attr) {
                $this = $($this);
            }

            if (!_self.isDoingRemoveFoldItem) {
                var id = $this.attr("id");

                _self.locationData[id].page = pageIndex;
                $(".drag-panel-container").removeClass("page-border-right");
                _self.moveDataToSpace($this);
            }

        }

        /****
         * 停止移动事件逻辑
         * @param $this
         * @param e
         */
        this.dataItemTouchend = function ($this, e) {
            $(".clone-move-item").hide();
            $(".drag-panel-container").removeClass("page-border-right")
                .removeClass("page-border-left").removeClass("page-border-top")
                .removeClass("page-border-bottom");
            $($this).css({
                "z-index": 1
            });
            if (!_self.currentPage) {
                _self.currentPage = 1;
            }

            var targetId = _self.lastWrapItem.id;

            var targetElement = null;
            if (_self.wrapDataItems[targetId]) {
                if (_self.wrapDataItems[targetId].length == 0) {
                    _self.moveDataToSpace($this);
                }
                else {
                    //找到当前页面的当前
                    for (var i = 0; i < _self.wrapDataItems[targetId].length; i++) {
                        if (_self.wrapDataItems[targetId][i].page == _self.currentPage) {
                            targetElement = _self.wrapDataItems[targetId][i];
                            break;
                        }
                    }
                    if (targetElement == null) {
                        _self.moveDataToSpace($this);
                        return;
                    }

                    if (targetElement.id === $($this).attr("id")) {
                        //还没有移出本格子
                        $($this).css({
                            "top": _self.lastWrapItem.position.top,
                            "left": _self.lastWrapItem.position.left
                        }).removeClass("ative");
                        $(self.lastWrapItem).removeClass("ative");
                        return;
                    }
                    else {
                        var thisType = $($this).attr("data-type");
                        //二个元素合并
                        if (targetElement.type === "data" && thisType === "data") {
                            _self.mergeToFold($this, targetElement);
                        } else if (thisType === "data" && targetElement.type === "fold") {
                            //移动到文件夹中
                            _self.moveToFold($this, targetElement);
                        }
                        else if (thisType === "fold") {
                            //文件夹移动进行二者位置互换
                            _self.changePlaces($this, targetElement);
                        }
                    }
                }
            }
            else {
                _self.moveDataToSpace($this);
            }

            //状态数据还原
            $("#" + targetId).removeClass('ative');
            $(_self).find("ative").each(function(){
                $(this).removeClass("ative");
            });
            _self.lastMoveDivItemIndex = null;
            _self.pageTurning = false;
            clearTimeout(_self.timeOutEvent);
            _self.timeOutEvent = 0;
            _self.longClick = false;

        };

        /****
         * 文件夹的移动
         * 文件夹移动不会进行合并，但是会进行位置替换
         * @param e
         */
        this.foldPageMove = function (e) {
            if (_self.foldWrapTouch) {
                _self.foldWrapTouch = null;
                return;
            }
            _self.endPageMoveX = e.changedTouches[0].pageX;
            _self.endPageMoveY = e.changedTouches[0].pageY;
            var moveDir = _self.getMoveDirection(_self.startPageMoveX, _self.startPageMoveY, _self.endPageMoveX, _self.endPageMoveY);
            _self.foldCurrentPage = _self.foldCurrentPage || 1;
            _self.totalFoldPage = $(".drag-enlarge-content .drag-page span").length;
            console.log("foldPageMove");
            switch (moveDir) {
                case "left":
                    if (_self.foldCurrentPage < _self.totalFoldPage) {
                        _self.foldCurrentPage++;
                        _self.turnToFoldPage(_self.foldCurrentPage);
                    }
                    break;
                case "right":
                    if (_self.foldCurrentPage > 1) {

                        _self.foldCurrentPage--;

                        _self.turnToFoldPage(_self.foldCurrentPage);
                    }
                    break;
            }
        }

        /****
         * 将二项合并成文件夹
         * @param source
         * @param target
         */
        this.mergeToFold = function (source, target) {

            var sourceId = $(source).attr("id");
            var sourceName = _self.locationData[sourceId].name;
            var sourceImg = _self.locationData[sourceId].img;

            var targetId = target.id;

            var targetName = _self.locationData[targetId].name;
            var targetImg = _self.locationData[targetId].img;

            var html = "<div class='data-div' data-page='1'>" +
                "<div class='data-item' data-type='data' id='" + sourceId + "'>"
                + "<div class='image' style='background-image: url(" + sourceImg + ")'></div>"
                + "<span>" + sourceName + "</span>"
                + "</div><div class='data-item' data-type='data' id='" + targetId + "'>"
                + "<div class='image' style=' background-image: url(" + targetImg + ")'></div>"
                + "<span >" + targetName + "</span></div></div>";

            var newId = _self.locationData[targetId].page.toString() + "_fold_" + sourceId + "__" + targetId;

            $("#" + sourceId).remove();
            $("#" + target.id).attr("id", newId).attr("data-type", "fold").find(".image")
                .css({"background-image": ""}).html(html).removeClass("image").addClass("fold");

            _self.locationData[sourceId].parentid = newId;
            _self.locationData[sourceId].position.left = "0";
            _self.locationData[sourceId].position.top = "0";

            _self.locationData[targetId].parentid = newId;
            _self.locationData[targetId].position.left = "30%";
            _self.locationData[targetId].position.top = "0";

            _self.locationData[newId] = {
                "page": _self.currentPage, "parentid": "", "position": {
                    "left": _self.lastWrapItem.position.left,
                    "top": _self.lastWrapItem.position.top
                }, "name": targetName
            }
            //将原来的位置给清除
            for (var entity in _self.wrapDataItems) {
                for (var i = 0; i < _self.wrapDataItems[entity].length; i++) {
                    if (_self.wrapDataItems[entity][i].page === _self.currentPage
                        && _self.wrapDataItems[entity][i].id === sourceId
                    ) {
                        _self.wrapDataItems[entity].splice(i, 1);
                    }
                    else if (_self.wrapDataItems[entity][i].page === _self.currentPage
                        && _self.wrapDataItems[entity][i].id === targetId
                    ) {
                        _self.wrapDataItems[entity][i].id = newId;
                        _self.wrapDataItems[entity][i].type = "fold";
                    }
                }
            }


            $("#" + target.id).off("touchstart").off("touchmove").off("touchend");
            $("#" + newId).on("touchstart", function (e) {
                _self.dataItemTouchStart(this, e);
            }).on("touchmove", function (e) {
                _self.dataItemTouchMove(this, e);
            }).on("touchend", function (e) {
                _self.dataItemTouchend(this, e);
            }).on("click", function (e) {
                _self.foldOnclick(this, e);
            })
        };

        /****
         * 将项目拖到文件夹中
         * @param source
         * @param target
         */
        this.moveToFold = function (source, target) {
            var sourceId = $(source).attr("id");
            var sourceName = _self.locationData[sourceId].name;
            var sourceImg = _self.locationData[sourceId].img;

            var targetWrapId = _self.lastWrapItem.id;
            var targetId = target.id;
            var $pages = $("#" + targetId).find(".fold .data-div");//获取到文件夹的节点
            var html = "<div class='data-item' data-type='data' id='" + sourceId + "'><div class='image'" +
                " style='background-image: url(" + sourceImg + ")'></div><span>" + sourceName + "</span></div>"

            var isAddNode = false;
            $("#" + sourceId).remove();
            if ($pages.length == 0) {
                html = "<div class='data-div' data-page='1'>" + html + "</div>";
                $("#" + targetId).find(".fold").append(html);
            }
            else {
                //将位置放到最近的空的格子位置中
                for (var i = 0; i < $pages.length; i++) {
                    var $pageItems = $($pages[i]).find(".data-item");
                    if ($pageItems.length < 9) {
                        $($pages[i]).append(html);
                        isAddNode = true;
                    }
                }
                if (!isAddNode) {
                    //需要进行新的页面新增
                    html = "<div class='data-div' style='display: none' data-page='" + ($pages.length + 1).toString() + "'>" + html + "</div>";
                    $("#" + targetId).find(".fold").append(html);
                }
            }
            $("#" + sourceId).off("touchstart").off("touchmove").off("touchend");
            _self.locationData[sourceId].parentid = targetId;
            _self.locationData[sourceId].position.left = "0";
            _self.locationData[sourceId].position.top = "0";

            //将原来的位置给清除
            for (var entity in _self.wrapDataItems) {
                for (var i = 0; i < _self.wrapDataItems[entity].length; i++) {
                    if (_self.wrapDataItems[entity][i].page === _self.currentPage
                        && _self.wrapDataItems[entity][i].id === sourceId
                    ) {
                        _self.wrapDataItems[entity].splice(i, 1);
                    }
                }
            }

        };

        /****
         * 二个元素互换位置
         * @param source
         * @param target
         */
        this.changePlaces = function (source, target) {
            if (!source || !target) {
                return;
            }
            var sourceId = $(source).attr("id");
            var sourceName = _self.locationData[sourceId].name;
            var sourceImg = _self.locationData[sourceId].img;

            var targetWrapId = _self.lastWrapItem.id;
            var targetId = target.id;

            var sourceLeft = _self.locationData[sourceId].position.left;
            var sourceTop = _self.locationData[sourceId].position.top;
            var targetLeft = _self.locationData[targetId].position.left;
            var targetTop = _self.locationData[targetId].position.top;

            $(source).css({"left": targetLeft, "top": targetTop});
            $("#" + targetId).css({"left": sourceLeft, "top": sourceTop});

            _self.locationData[sourceId].position.left = targetLeft;
            _self.locationData[sourceId].position.top = targetTop;
            _self.locationData[targetId].position.left = sourceLeft;
            _self.locationData[targetId].position.top = sourceTop;

            var sourceEntity = null;
            var sourceIndex = null;
            var sourceType = null;
            var targetEntity = null;
            var targetIndex = null;
            //将原来的位置给清除
            for (var entity in _self.wrapDataItems) {
                for (var i = 0; i < _self.wrapDataItems[entity].length; i++) {
                    if (_self.wrapDataItems[entity][i].page === _self.currentPage
                        && _self.wrapDataItems[entity][i].id === sourceId
                    ) {
                        sourceEntity = entity;
                        sourceIndex = i;
                        sourceType = _self.wrapDataItems[entity][i].type;

                    }
                    else if (_self.wrapDataItems[entity][i].page === _self.currentPage
                        && _self.wrapDataItems[entity][i].id === targetId) {
                        targetEntity = entity;
                        targetIndex = i;
                    }
                }
            }
            if (!sourceEntity) {
                return;
            }
            _self.wrapDataItems[sourceEntity][sourceIndex].id = targetId;
            _self.wrapDataItems[sourceEntity][sourceIndex].type = target.type;

            if (!targetEntity) {
                return;
            }
            _self.wrapDataItems[targetEntity][targetIndex].id = sourceId;
            _self.wrapDataItems[targetEntity][targetIndex].type = sourceType;

        };

        /***
         * 关闭放大图
         */
        this.closeDragEnlarge = function () {
            var datas = $(".drag-enlarge-bg .drag-enlarge-content").find(".data-div");
            var targetId = $(".drag-enlarge-bg").attr("data-target-id");

            var targetFoldDoc = $(_self).find(".drag-panel-container .data-div #" + targetId);

            var html = ""
            if (datas && datas.length > 0) {
                var pageCount = datas.length;
                var pageIds = {};
                for (var i = 1; i < pageCount + 1; i++) {
                    pageIds[i] = [];
                }
                for (var entity in _self.foldWrapDataItems) {
                    if (_self.foldWrapDataItems[entity].items && _self.foldWrapDataItems[entity].items.length > 0) {
                        for (var i = 0; i < _self.foldWrapDataItems[entity].items.length; i++) {
                            pageIds[i - 0 + 1].push(_self.foldWrapDataItems[entity].items[i].id);
                        }
                    }
                }
                var pageDiv = "";
                for (var page in pageIds) {
                    pageDiv += "<div class='data-div' data-page='" + page + "'>";
                    for (var i = 0; i < pageIds[page].length; i++) {
                        var id = pageIds[page][i];
                        pageDiv += "<div class='data-item' data-type='data' id='" + id + "'>";
                        var imgUrl = _self.locationData[id].img;

                        pageDiv += "<div class='image' style='background-image: url(" + imgUrl + ")'></div>";
                        var name = _self.locationData[id].name;
                        pageDiv += "<span>" + name + "</span>";
                        pageDiv += "</div>";
                    }
                    pageDiv += "</div>";
                }
                $(targetFoldDoc).find(".fold").html(pageDiv);
            }
            else {
                _self.find("#" + targetId).remove();//没有子数据了就进行删除
            }
            if (_self.isDoingRemoveFoldItem) {
                $(".drag-enlarge-bg").hide();
            }
            else {
                $(".drag-enlarge-bg").remove();
                var moveWrapId = _self.lastWrapItem.id;
                $("#" + moveWrapId).removeClass("ative");
            }

            $(targetFoldDoc).find(".data-div[data-page='" + _self.currentPage + "']").css({"display": "block"}).siblings(".data-div")
                .css({"display": "none"});
            _self.foldCurrentPage = null;
        };

        /***
         * 文件夹选项的移动开始
         * @param $this
         * @param e
         */
        this.foldItemTouchStart = function ($this, e) {

            _self.foldWrapTouch = true;
            var curPage = _self.foldCurrentPage || 1;

            var thisId = $($this).attr("id");
            if (!_self.foldWrapDataItems[thisId].items[curPage - 1]) {
                _self.foldWrapTouch = false;
                return;
            }

            _self.foldWrapTouch = true;
            var targetId = _self.foldWrapDataItems[thisId].items[curPage - 1].id;

            _self.startPageMoveX = e.touches[0].pageX;
            _self.startPageMoveY = e.touches[0].pageY;

            var $moveDivItem = $("body .drag-enlarge-content").find("#" + targetId);

            $($moveDivItem).addClass("ative");

            _self.startSubItemposition = $($this).position();
            var ev = e.originalEvent.touches[0];
            _self.disX = ev.pageX - _self.startSubItemposition.left;
            _self.disY = ev.pageY - _self.startSubItemposition.top;

            _self.lastSubWrapItem = $this;
            _self.lastMoveDivItem = $moveDivItem;
            _self.beginPageTrun = _self.foldCurrentPage || 1;//记录进行翻页前的页数

            _self.lastMoveDivItemIndex = $(_self.lastMoveDivItem).index();

        };

        /****
         * 子文件夹中移动到哪一个格子，以最大的面积交叠的返回
         * @param left
         * @param top
         * @returns {*}
         */
        this.getTargetWrap = function (left, top) {
            _self.dragEnlargeContentWidth = _self.dragEnlargeContentWidth || $(".drag-enlarge-bg .drag-enlarge-content").width();
            _self.dragEnlargeContentHeight = _self.dragEnlargeContentHeight || $(".drag-enlarge-bg .drag-enlarge-content").height();

            var maxArea = 0;
            var maxEntity = null;
            for (var entity in _self.foldWrapDataItems) {
                var entityLeft = _self.foldWrapDataItems[entity].position.left.replace("%", "") / 100 * _self.dragEnlargeContentWidth;
                var entityTop = _self.foldWrapDataItems[entity].position.top.replace("%", "") / 100 * _self.dragEnlargeContentHeight;

                var getArea = _self.getOverFoldWrapArea(left, top, entityLeft, entityTop);

                if (getArea > maxArea) {
                    maxArea = getArea;
                    maxEntity = entity;
                }
            }

            return _self.foldWrapDataItems[maxEntity];
        };

        /***
         * 子页面翻页翻到原始的页面
         * @param $this
         * @param e
         */
        this.goFoldBack = function ($this, e) {

            if (_self.lastMoveDivItemIndex == 0) {
                var firstChild = $("body .drag-enlarge-bg .drag-enlarge-content .data-div[data-page='" + _self.beginPageTrun + "'] .data-item:first");
                $(_self.lastMoveDivItem).insertBefore(firstChild);//原本在第一个元素，现在还是插入到第一个元素的位置
            }
            else {
                //原本的上一个节点
                var preBrother = $("body .drag-enlarge-bg .drag-enlarge-content .data-div[data-page='" + _self.beginPageTrun + "'] .data-item:nth-child(" + (_self.lastMoveDivItemIndex) + ")");
                $(_self.lastMoveDivItem).insertAfter(preBrother);//原本在第一个元素，现在还是插入到第一个元素的位置
            }
        };

        /***
         * 将元素从文件夹中移除,
         * 只是将container元素往前，临时文件进行移动
         * 这样就可以进行了遮罩
         * @param el
         */
        this.removeItemFromFold = function (el) {
            _self.beginPageTrun = _self.currentPage;
            _self.isDoingRemoveFoldItem = true;
            var $el = $(el);
            var $thisHtml = $el.html();//移动项的html
            var positionLeft = $el.offset().left;
            var positionTop = $el.offset().top;

            var id = $el.attr("id");
            $(".drag-panel-container .clone-move-item").html($thisHtml).css({
                "left": positionLeft + "px",
                "top": positionTop + "px",
                "z-index": 9999999
            }).show().attr("data-move-id",id);

            $(".drag-panel-container").css({
                "background": "#fff",
                "z-index": 9999998
            })
        };

        /***
         * 子项移动过程中的逻辑处理
         * @param $this
         * @param e
         */
        this.foldItemTouchMove = function ($this, e) {
            var ev = e.type == 'touchmove' ? e.originalEvent.touches[0] : e;
            var $parent = $("body");
            if (_self.isDoingRemoveFoldItem) {

                var positionLeft = ev.pageX;
                var positionTop = ev.pageY;

                if (positionLeft + _self.customWidth >= $parent.width()) {
                    positionLeft = $parent.width() - _self.customWidth;
                }
                if (positionLeft < 0) {
                    positionLeft = 0;
                }
                if (positionTop < 0) {
                    positionTop = 0;
                }
                if (positionTop + _self.customHeight > $parent.height()) {
                    positionTop = $parent.height() - _self.customHeight;
                }

                console.log("positionLeft", positionLeft);
                $(".drag-panel-container .clone-move-item").css({
                    "left": positionLeft + "px",
                    "top": positionTop + "px",
                    "z-index": 9999999
                }).show();
                var wrapItem = _self.getWrapDomRangeByPosition(positionLeft, positionTop);
                if (wrapItem) {
                    if (_self.lastWrapItem.id != wrapItem.id) {
                        $("#" + _self.lastWrapItem.id).removeClass("ative");//将原来已经激活的item 边框去掉
                        _self.lastWrapItem = wrapItem;
                        $("#" + wrapItem.id).addClass("ative");//激活边框
                    }
                }
                else {
                    //位置不在边框wrap中，将去掉所有的边框激活状态
                    if (_self.lastWrapItem) {

                        $("#" + _self.lastWrapItem.id).removeClass("ative");//激活边框
                    }
                }

                clearTimeout(_self.timeOutEvent);
                _self.timeOutEvent = 0;
                _self.longClick = false;

                if (positionLeft == 0 && _self.currentPage > 1) {
                    $(".drag-panel-container").addClass("page-border-left");
                }
                else if (positionLeft + _self.customWidth >= $parent.width()) {
                    $(".drag-panel-container").addClass("page-border-right");
                }
                //坚持1s钟
                _self.timeOutEvent = setTimeout(function () {
                    _self.longClick = true;

                    //向前翻页
                    if (positionLeft == 0 && _self.currentPage > 1) {
                        var prePage = _self.currentPage - 1;
                        //翻页回到了原始页位置
                        if (prePage === _self.beginPageTrun) {
                            _self.goBack();
                        }
                        else {
                            //翻页到前面的一页
                            _self.turnToPage(prePage);
                            //翻页过后记录状态
                            var prePageNode = $(".drag-panel-container .data-div[data-page=" + _self.currentPage + "]");
                            $(prePageNode).append($this);
                            _self.pageTurning = true;
                        }
                    }
                    //向后翻页
                    else if (positionLeft + _self.customWidth >= $parent.width()) {
                        _self.pageTurning = true;
                        var nextPage = _self.currentPage + 1;
                        //向后翻页时又翻回来到原始页
                        if (nextPage == _self.beginPageTrun) {
                            _self.goBack();
                        }
                        else {
                            //向后翻页
                            var $nextPageNode = $(".drag-panel-container .data-div[data-page=" + nextPage.toString() + "]");
                            //如果有后一页，则往后翻页
                            if ($nextPageNode && $nextPageNode.length > 0) {
                                _self.turnToPage(nextPage);

                            }
                            else {
                                //创建新一页
                                _self.moveAndCreateDataItemNewPage(_self.lastMoveDivItem, nextPage);
                            }
                        }

                    }
                }, _self.longClickTimeOut);
                return;
            }

            var thisId = $($this).attr("id");
            var curPage = _self.foldCurrentPage || 1;
            if ((!_self.foldWrapDataItems[thisId].items[curPage - 1]) && (!_self.pageTurning)) {
                return;
            }


            var $this = $($this),
                $parent = $this.offsetParent();
            $parent = $parent.is(':root') ? $("body") : $parent;

            var pPos = $parent.offset();

            var pPos = pPos ? pPos : {left: 0, top: 0},

                left = ev.pageX - _self.disX,
                top = ev.pageY - _self.disY,

                r = $parent.width() - $this.outerWidth(true) / 2,
                d = $parent.height() - $this.outerHeight(true) / 2;

            left = left < -$this.outerWidth(true) / 2 ? -$this.outerWidth(true) / 2 : left > r ? r : left;
            top = top < 0 - $this.outerHeight(true) / 2 ? 0 - $this.outerHeight(true) / 2 : top > d ? d : top;

            top = top > $parent.height() ?
            $parent.height() - $this.outerHeight(true) / 2 : top;

            $($this).css({
                left: left + 'px',
                top: top + 'px',
                "z-index": 99999
            });
            $(_self.lastMoveDivItem).css({
                left: left + 'px',
                top: top + 'px',
                "z-index": 99999
            });
            _self.targetDivItem = _self.getTargetWrap(left, top);

            if (_self.targetDivItem) {
                //  console.log(_self.targetDivItem.id);
                $(".drag-enlarge-bg .drag-enlarge-content .wrap #" + _self.targetDivItem.id)
                    .addClass("ative").siblings("span").removeClass("ative")
            }

            _self.dragConentDiv = _self.dragConentDiv || $("body .drag-enlarge-bg .drag-enlarge-content");
            var pageCount = $(".drag-enlarge-bg .drag-enlarge-content").find(".data-div").length;

            var canTurnNextPage = (pageCount > 1) && (_self.foldCurrentPage < pageCount);//可以跳转到下一页
            var canPrePage = pageCount >= 1 && _self.foldCurrentPage > 1;//可以跳转到上一页

            var canTopBorderShow = top < 0 && (left > 0 && left < (left + _self.customFoldWrapWidth) < _self.dragEnlargeContentWidth);//将数据从上移出
            var canBottomBorderShow = ((top + $($this).height()) > _self.dragEnlargeContentHeight) &&
                (left + _self.customFoldWrapWidth < _self.dragEnlargeContentWidth) &&
                left > 0;


            if (canTopBorderShow) {
                $(_self.dragConentDiv).addClass("long-click-top");
                $(".drag-enlarge-bg .drag-enlarge-content-border").show();
            }
            else {
                $(_self.dragConentDiv).removeClass("long-click-top");
            }
            if (canBottomBorderShow) {
                $(_self.dragConentDiv).addClass("long-click-bottom");
                $(".drag-enlarge-bg .drag-enlarge-content-border").show();
            }
            else {
                $(_self.dragConentDiv).removeClass("long-click-bottom");
            }

            //移动到右边界
            if ((left + _self.customFoldWrapWidth) >= _self.dragEnlargeContentWidth && canTurnNextPage) {
                $(_self.dragConentDiv).addClass("long-click-right");
            }
            else {
                $(_self.dragConentDiv).removeClass("long-click-right");
            }
            if (left < 0 && canPrePage) {
                $(_self.dragConentDiv).addClass("long-click-left");
            }
            else {
                $(_self.dragConentDiv).removeClass("long-click-left");
            }
            //  var targetId = _self.foldWrapDataItems[thisId].items[curPage - 1].id;

            clearTimeout(_self.timeOutEvent);
            _self.timeOutEvent = 0;
            _self.longClick = false;
            _self.timeOutEvent = setTimeout(function () {
                _self.dragEnlargeContentWidth = _self.dragEnlargeContentWidth ||
                $(".drag-enlarge-bg .drag-enlarge-content").width();
                _self.dragEnlargeContentHeight = _self.dragEnlargeContentHeight ||
                $(".drag-enlarge-bg .drag-enlarge-content").height();

                _self.customFoldWrapWidth = _self.customFoldWrapWidth || $(_self.lastMoveDivItem).width();
                _self.customFoldWrapHeight = _self.customFoldWrapHeight || $(_self.lastMoveDivItem).height();

                _self.longClick = true;//假如长按，则设置为1
                _self.foldCurrentPage = _self.foldCurrentPage || 1;

                //将元素从弹出的文件夹中移除
                if (canTopBorderShow || canBottomBorderShow) {
                    $(".drag-enlarge-bg .drag-enlarge-content-border").show();

                    _self.removeItemFromFold(_self.lastMoveDivItem);
                    return;
                }
                if (_self.foldCurrentPage === 1 && left <= 0) {
                    _self.removeItemFromFold(_self.lastMoveDivItem);
                }

                if (_self.foldCurrentPage === pageCount &&
                    (left + _self.customFoldWrapWidth) >= _self.dragEnlargeContentWidth) {
                    _self.removeItemFromFold(_self.lastMoveDivItem);
                }


                if ((pageCount > 1) && (_self.foldCurrentPage < pageCount) &&
                    ((left + _self.customFoldWrapWidth) >= _self.dragEnlargeContentWidth) && (!_self.isDoingRemoveFoldItem)) {

                    var nextPage = _self.foldCurrentPage + 1;
                    _self.turnToFoldPage(nextPage);

                    //又翻滚回到它原本的页面位置
                    if (_self.beginPageTrun == _self.foldCurrentPage) {
                        _self.goFoldBack();
                        _self.pageTurning = false;
                        return;
                    }
                    var nextPageNode = $("body .drag-enlarge-bg .drag-enlarge-content .data-div[data-page=" + nextPage.toString() + "]");
                    $(nextPageNode).append(_self.lastMoveDivItem);
                    _self.pageTurning = true;

                }
                else if (pageCount >= 1 && _self.foldCurrentPage > 1 && left <= 0 && (!_self.isDoingRemoveFoldItem)) {
                    var prePage = _self.foldCurrentPage - 1;
                    _self.turnToFoldPage(prePage);

                    //又翻滚回到它原本的页面位置
                    if (_self.beginPageTrun == _self.foldCurrentPage) {
                        _self.goFoldBack();
                        _self.pageTurning = false;
                        return;
                    }
                    var prePageNode = $("body .drag-enlarge-bg .drag-enlarge-content .data-div[data-page=" + prePage.toString() + "]");

                    $(prePageNode).append(_self.lastMoveDivItem);

                    _self.pageTurning = true;
                }

            }, _self.longClickTimeOut);
        };

        /****
         * 换页效果完成以后
         * @param $this
         * @param e
         */
        this.pageTured = function ($this, e) {
            var thisId = $($this).attr("id");
            var targetId = _self.targetDivItem.id;

            var targetIndex = targetId.substr(targetId.lastIndexOf("_") + 1);
            var sourceIndex = thisId.substr(thisId.lastIndexOf("_") + 1);
            var beginPage = _self.beginPageTrun;
            var endPage = _self.foldCurrentPage;
            var changePageElmemts = {};//记录需要进行重新排位的数据，根据此变量重新进行生成页面的元素
            if (_self.beginPageTrun > _self.foldCurrentPage) {
                //由后往前进行拖
                beginPage = _self.foldCurrentPage;
                endPage = _self.beginPageTrun;
            }

            //从后往前进行移动
            if (_self.beginPageTrun > _self.foldCurrentPage) {
                var nextId = "";
                for (var tmpPage = beginPage; tmpPage <= endPage; tmpPage++) {
                    changePageElmemts[tmpPage] = {};
                    for (var wrapId in _self.foldWrapDataItems) {
                        var wrapIndex = wrapId.substr(wrapId.lastIndexOf("_") + 1);
                        var tmpWrapIndex = wrapIndex - 1;

                        var wrapLeft = _self.foldWrapLefts[tmpWrapIndex % 3];
                        var wrapTop = _self.foldWrapTops[0];
                        if (tmpWrapIndex > 2 && tmpWrapIndex <= 5) {
                            wrapTop = _self.foldWrapTops[1];
                        }
                        else if (tmpWrapIndex > 5 && tmpWrapIndex < 9) {
                            wrapTop = _self.foldWrapTops[2];
                        }

                        //存在数据
                        if (_self.foldWrapDataItems[wrapId].items[tmpPage - 1]) {
                            var id = _self.foldWrapDataItems[wrapId].items[tmpPage - 1].id;

                            //第一面的目标位置的前面的元素不做修改
                            if (wrapIndex < targetIndex && tmpPage === beginPage) {

                                changePageElmemts[tmpPage][id] = {};
                                changePageElmemts[tmpPage][id].position = {};
                                changePageElmemts[tmpPage][id].position.left = wrapLeft;
                                changePageElmemts[tmpPage][id].position.top = wrapTop;
                                changePageElmemts[tmpPage][id].wrapId = wrapId;
                            }
                            //第一个元素
                            else if (wrapIndex === targetIndex && tmpPage === beginPage) {

                                var targetDivId = $(_self.lastMoveDivItem).attr("id");
                                console.log(targetDivId);
                                changePageElmemts[tmpPage][targetDivId] = {};
                                changePageElmemts[tmpPage][targetDivId].position = {};
                                changePageElmemts[tmpPage][targetDivId].position.left = wrapLeft;
                                changePageElmemts[tmpPage][targetDivId].position.top = wrapTop;
                                changePageElmemts[tmpPage][targetDivId].wrapId = wrapId;
                                nextId = id;
                            }
                            else if ((wrapIndex > targetIndex && tmpPage === beginPage) ||
                                (tmpPage > beginPage && tmpPage < endPage) ||
                                (tmpPage === endPage && wrapIndex <= sourceIndex)) {
                                changePageElmemts[tmpPage][nextId] = {};
                                changePageElmemts[tmpPage][nextId].position = {};
                                changePageElmemts[tmpPage][nextId].position.left = wrapLeft;
                                changePageElmemts[tmpPage][nextId].position.top = wrapTop;
                                changePageElmemts[tmpPage][nextId].wrapId = wrapId;
                                nextId = id;
                            }
                            else if (tmpPage === endPage && wrapIndex > sourceIndex) {
                                changePageElmemts[tmpPage][id] = {};
                                changePageElmemts[tmpPage][id].position = {};
                                changePageElmemts[tmpPage][id].position.left = wrapLeft;
                                changePageElmemts[tmpPage][id].position.top = wrapTop;
                                changePageElmemts[tmpPage][id].wrapId = wrapId;
                            }
                        }
                    }

                }

            }
            //从前往后移动
            else if (_self.beginPageTrun < _self.foldCurrentPage) {
                var divCount = $(_self).find(".drag-enlarge-bg .drag-enlarge-content .data-div[data-page='" + _self.foldCurrentPage + "'] .data-item").length;
                //放在了目标页的空白位置,因为自身不属性本页，所以进行了减1操作
                if (targetIndex > divCount - 1) {
                    targetIndex = divCount - 1;
                }
                targetIndex = targetIndex - 0;//强制转换为数字

                nextId = "";
                for (var tmpPage = endPage; tmpPage >= beginPage; tmpPage--) {

                    changePageElmemts[tmpPage] = {};
                    for (var wrapIndex = 9; wrapIndex >= 1; wrapIndex--) {
                        var tmpWrapIndex = wrapIndex - 1;

                        var wrapLeft = _self.foldWrapLefts[tmpWrapIndex % 3];
                        var wrapTop = _self.foldWrapTops[0];
                        if (tmpWrapIndex > 2 && tmpWrapIndex <= 5) {
                            wrapTop = _self.foldWrapTops[1];
                        }
                        else if (tmpWrapIndex > 5 && tmpWrapIndex < 9) {
                            wrapTop = _self.foldWrapTops[2];
                        }
                        var wrapId = "fold_wrap_" + wrapIndex.toString();
                        if (_self.foldWrapDataItems[wrapId].items[tmpPage - 1]) {
                            var id = _self.foldWrapDataItems[wrapId].items[tmpPage - 1].id;
                            //目标面的目标位置的放置的元素不做修改及原始页面在移动元素之前的位置不做修改
                            if ((wrapIndex > targetIndex && tmpPage === endPage) || (wrapIndex < sourceIndex && tmpPage === beginPage)) {
                                changePageElmemts[tmpPage][id] = {};
                                changePageElmemts[tmpPage][id].position = {};
                                changePageElmemts[tmpPage][id].position.left = wrapLeft;
                                changePageElmemts[tmpPage][id].position.top = wrapTop;
                                changePageElmemts[tmpPage][id].wrapId = wrapId;
                            }
                            //目标位置
                            else if (wrapIndex == targetIndex && tmpPage === endPage) {
                                var sourceId = $(_self.lastMoveDivItem).attr("id");

                                changePageElmemts[tmpPage][sourceId] = {};
                                changePageElmemts[tmpPage][sourceId].position = {};
                                changePageElmemts[tmpPage][sourceId].position.left = wrapLeft;
                                changePageElmemts[tmpPage][sourceId].position.top = wrapTop;
                                changePageElmemts[tmpPage][sourceId].wrapId = wrapId;
                                nextId = id;
                            }
                            else if ((wrapIndex < targetIndex && tmpPage === endPage) ||
                                (wrapIndex >= sourceIndex && tmpPage === beginPage) ||
                                (tmpPage > beginPage && tmpPage < endPage)
                            ) {
                                changePageElmemts[tmpPage][nextId] = {};
                                changePageElmemts[tmpPage][nextId].position = {};
                                changePageElmemts[tmpPage][nextId].position.left = wrapLeft;
                                changePageElmemts[tmpPage][nextId].position.top = wrapTop;
                                changePageElmemts[tmpPage][nextId].wrapId = wrapId;
                                nextId = id;
                            }
                        }
                    }
                }
            }

            for (var page in changePageElmemts) {
                var pageDivHtml = "";
                var pageDiv = $(".drag-enlarge-bg .drag-enlarge-content .data-div[data-page='" + page + "']")
                for (var id in changePageElmemts[page]) {
                    var left = changePageElmemts[page][id].position.left;
                    var top = changePageElmemts[page][id].position.top;
                    var wrapId = changePageElmemts[page][id].wrapId;
                    pageDivHtml += "<div class='data-item' style='left:" + left + ";top:" + top + "' data-type='data' id='" + id + "'>" +
                    "<div class='image' style='background-image: url(" + _self.locationData[id].img + ")'></div>" +
                    "<span>" + _self.locationData[id].name + "</span></div>"

                    _self.foldWrapDataItems[wrapId].items[page - 1].id = id;
                }

                $(pageDiv).html(pageDivHtml);
            }
            _self.pageTurning = false;

            $($this).css({
                "left": _self.foldWrapDataItems[thisId].position.left,
                "top": _self.foldWrapDataItems[thisId].position.top
            }).removeClass("ative");
            $("#" + targetId).removeClass("ative");
        }

        /***
         * 将文件项目从文件夹中移出处理后的功能，
         * 重新生成原来文件夹的html及事件
         * @param isRemoveItem 是否需要删除掉移动操作的文件
         */
        this.afterFoldItemHandle = function(isRemoveItem){
            var $tmpfold=$(_self.fromFoldContent);
            var itemId = _self.lastMoveDivItem.attr("id");
            var wrapId = _self.lastWrapItem.id;
            if(!isRemoveItem){
                $("#"+_self.fromFoldItemId).html(_self.fromFoldContent);//还原原来的html
            }
            else{
                //原来只有一个文件，现在进行了删除，得连着文件夹一起删除
                if($tmpfold.find(".data-item").length==1){
                    $("#"+_self.fromFoldItemId).remove();
                    for(var i=0;i<_self.wrapDataItems[wrapId].length;i++){
                        if(_self.wrapDataItems[wrapId][i]===itemId){
                            _self.wrapDataItems[wrapId].splice(i,1);//将数据wrapDataItem项数据删除
                            break;
                        }
                    }
                    delete _self.locationData[_self.fromFoldItemId];//将locationData 里面的数据删除
                }
                else{
                    $($tmpfold.find(".data-item[id='"+itemId+"']")).remove();//将移动项给删除

                    //进行移位操作
                    var onePageCount = 9;
                    var tmpArray = [];
                    var pageIndex = 1;
                    var pageCount = Math.ceil($tmpfold.find(".data-item").length/onePageCount);
                    var pageDiv = {};
                    for(var i=1;i<=pageCount;i++){
                        pageDiv[i]=[];
                    }
                    $tmpfold.find(".data-item").each(function(index){
                        if(index!=0 && (index % onePageCount ===0)){
                            pageIndex++
                        }
                        pageDiv[pageIndex].push($(this).prop("outerHTML"));
                    });

                    $tmpfold.html("");
                    var pageTemplate = "<div class='data-div' data-page='{{pageIndex}}' style='display: {{displayPage}};'>" ;
                    var tempStr = "";
                    for(x in pageDiv){
                        if(x==1){
                            tempStr += pageTemplate.replace("{{pageIndex}}","1").replace("{{displayPage}}","block");
                        }
                        else{
                            tempStr += pageTemplate.replace("{{pageIndex}}", x.toString()).replace("{{displayPage}}","none");
                        }
                        for(var i=0;i<pageDiv[x].length;i++){
                            tempStr +=pageDiv[x][i];
                        }
                        tempStr+="</div>"
                    }
                    $tmpfold.html(tempStr);
                    $("#"+_self.fromFoldItemId+" .fold").html($tmpfold.html()).click(function(e){
                        _self.foldOnClick(this,e);
                    });//重新设置fold里面的html
                }
            }
        }



        /****
         * 将文件夹里面的文件移出，放到相应的位置
         * 1、如果是位置在原来的文件夹位置，不做处理
         * 2、如果是位置在一个文件位置，二者合并
         * 3、如果是在另外的一个文件夹位置，则将此文件移动到该文件夹下面
         * @param $this
         */
        this.removeFoldItemHandle = function ($span,e) {
            var targetWrapItem = _self.getWrapDomRangeByPosition(e.changedTouches[0].pageX,e.changedTouches[0].pageY);
            var $this = _self.lastMoveDivItem;
            var thisId = $this.attr("id");

            $this.removeClass("ative");

            var targetElement = null;
            //找到当前页面的当前
            for (var i = 0; i < _self.wrapDataItems[targetWrapItem.id].length; i++) {
                if (_self.wrapDataItems[targetWrapItem.id][i].page === _self.currentPage) {
                    targetElement = _self.wrapDataItems[targetWrapItem.id][i];
                    break;
                }
            }

            //拖动回到原来文件夹的位置，不做任何处理
            if (_self.currentPage === _self.beginPageTrun && _self.lastWrapItem.id===_self.fromFoldWrap.id) {
                return;
            }
            //移动到一个空位置
            if(!targetElement){
                _self.moveDataToSpace($(_self.lastMoveDivItem));
                _self.afterFoldItemHandle(false);
                return;
            }

            var targetType = targetElement.type;
            //移动到一个文件图标位置上
            if(targetType==="data"){
                _self.mergeToFold($this, targetElement);
                _self.afterFoldItemHandle(true);
            }
            //移动到一个文件夹图标上面
            else if(targetType==="fold"){
                //移动到文件夹中
                _self.moveToFold($(_self.lastMoveDivItem), targetElement);
                _self.afterFoldItemHandle(true);
            }
        }
        /***
         * 文件夹移动结束时的逻辑
         * @param $this
         * @param e
         */
        this.foldItemTouchedEnd = function ($this, e) {
            clearTimeout(_self.timeOutEvent);
            _self.timeOutEvent = 0;
            //在移动删除文件夹项目
            if (_self.isDoingRemoveFoldItem) {
                _self.removeFoldItemHandle($this,e);
                _self.isDoingRemoveFoldItem = false;
                _self.fromFoldWrap = null;
                _self.pageTurning = false;
                $(".drag-panel-container .clone-move-item").hide();
                $(".drag-enlarge-bg").remove();

                $(".drag-panel-container").css({
                    "z-index":1
                });
                return;
            }

            $("body .drag-enlarge-bg .drag-enlarge-content").removeClass("long-click-right").removeClass("long-click-left");
            $(".drag-enlarge-content .drag-enlarge-content-border").hide();

            //进行页面切换的逻辑
            if (_self.pageTurning) {
                _self.lastMoveDivItemIndex = null;
                _self.pageTured($this, e);
                return;
            }
            else {
                _self.endPageMoveX = e.changedTouches[0].pageX;
                _self.endPageMoveY = e.changedTouches[0].pageY;
                var moveDir = _self.getMoveDirection(_self.startPageMoveX, _self.startPageMoveY, _self.endPageMoveX, _self.endPageMoveY);
                if (moveDir === "") {
                    console.log("这是点击事件");
                    $(".drag-enlarge-content .data-div .data-item").removeClass("ative");
                    return;
                }
            }

            _self.foldCurrentPage = _self.foldCurrentPage || 1;

            if (!_self.targetDivItem) {
                return;
            }

            var curPage = _self.foldCurrentPage || 1;

            var thisId = $($this).attr("id");
            var targetId = _self.targetDivItem.id;

            //移动到空的位置
            if (!_self.foldWrapDataItems[targetId].items[_self.foldCurrentPage - 1]) {
                //从空格进行移动
                if (!_self.foldWrapDataItems[thisId].items[_self.foldCurrentPage - 1]) {
                    return;
                }

                $(_self.lastMoveDivItem).css({
                    "z-index": 0,
                    "left": _self.foldWrapDataItems[thisId].position.left,
                    "top": _self.foldWrapDataItems[thisId].position.top
                }).removeClass("ative");
                $($this).css({
                    "left": _self.foldWrapDataItems[thisId].position.left,
                    "top": _self.foldWrapDataItems[thisId].position.top
                });
                var targetDivEntity = $("body .drag-enlarge-content").find("#" + targetDataDivId);
                $(targetDivEntity).removeClass("ative");
                $("body .drag-enlarge-content").find("#" + targetId).removeClass("ative");
                _self.pageTurning = false;
                $(".drag-enlarge-bg").remove();
                return;
            }

            var targetWrapEntity = $("body .drag-enlarge-content").find("#" + targetId);

            if (!_self.foldWrapDataItems[targetId].items[_self.foldCurrentPage - 1]) {
                return;
            }

            var targetDataDivId = _self.foldWrapDataItems[targetId].items[_self.foldCurrentPage - 1].id;

            $(_self.lastMoveDivItem).css({
                "z-index": 0,
                "left": _self.targetDivItem.position.left,
                "top": _self.targetDivItem.position.top,
            }).removeClass("ative");
            //wrap移到原位置
            $($this).removeClass("ative").css({
                left: _self.foldWrapDataItems[thisId].position.left,
                top: _self.foldWrapDataItems[thisId].position.top
            });
            var thisIndex = thisId.substr(thisId.lastIndexOf("_") + 1);
            var targetIndex = targetId.substr(targetId.lastIndexOf("_") + 1);

            if (!_self.foldWrapDataItems[thisId].items[_self.foldCurrentPage - 1]) {
                return;
            }
            var thisDataDivId = _self.foldWrapDataItems[thisId].items[_self.foldCurrentPage - 1].id;

            var difIndex = Math.abs(targetIndex - thisIndex);


            //位置没有移出
            if (difIndex == 0) {
                return;
            }
            else if (difIndex == 1) {
                //相邻的二个位置互换即可
                var targetDivEntity = $("body .drag-enlarge-content").find("#" + targetDataDivId);
                $(targetDivEntity).removeClass("ative");
                $(targetDivEntity).css({
                    left: _self.foldWrapDataItems[thisId].position.left,
                    top: _self.foldWrapDataItems[thisId].position.top
                });

                _self.foldWrapDataItems[thisId].items[_self.foldCurrentPage - 1].id = targetDataDivId;
                _self.foldWrapDataItems[targetId].items[_self.foldCurrentPage - 1].id = thisDataDivId;
            }
            else {
                var wrapId = "";
                var nextWrapId = "";

                //从前往后移动
                if (targetIndex > thisIndex) {
                    for (var i = thisIndex; i < targetIndex; i++) {
                        wrapId = "fold_wrap_" + i.toString();
                        nextWrapId = "fold_wrap_" + (i - 0 + 1).toString();

                        var nextId = _self.foldWrapDataItems[nextWrapId].items[_self.foldCurrentPage - 1].id;

                        var nextDivEntity = $("body .drag-enlarge-content").find("#" + nextId);

                        $(nextDivEntity).css({

                            left: _self.foldWrapDataItems[wrapId].position.left,
                            top: _self.foldWrapDataItems[wrapId].position.top
                        });
                        _self.foldWrapDataItems[wrapId].items[_self.foldCurrentPage - 1].id = nextId;

                    }
                }
                else {
                    for (var i = thisIndex; i > targetIndex; i--) {
                        wrapId = "fold_wrap_" + i.toString();
                        nextWrapId = "fold_wrap_" + (i - 1).toString();

                        var nextId = _self.foldWrapDataItems[nextWrapId].items[_self.foldCurrentPage - 1].id;

                        var nextDivEntity = $("body .drag-enlarge-content").find("#" + nextId);
                        $(nextDivEntity).css({
                            left: _self.foldWrapDataItems[wrapId].position.left,
                            top: _self.foldWrapDataItems[wrapId].position.top
                        });
                        _self.foldWrapDataItems[wrapId].items[_self.foldCurrentPage - 1].id = nextId;
                    }
                }
                _self.foldWrapDataItems[targetId].items[_self.foldCurrentPage - 1].id = thisDataDivId;
            }

            _self.pageTurning = false;
            _self.isDoingRemoveFoldItem = false;

            $(targetWrapEntity).off("touchstart").off("touchmove").off("touchend").removeClass("ative");
            $(targetWrapEntity).on("touchstart", function (e) {
                _self.foldItemTouchStart(this, e);
            }).on("touchmove", function (e) {
                _self.foldItemTouchMove(this, e);
            }).on("touchend", function (e) {
                _self.foldItemTouchedEnd(this, e);
            })
        };

        /***
         * 文件夹的单击事件
         * @param target
         * @param e
         */
        this.foldOnclick = function (target, e) {
            var content = $(target).html();
            var id = $(target).parent().attr("id");

            _self.fromFoldContent = $(target).prop("outerHTML");//记录好原来文件夹的html，以便于停止移动后进行相应的还原
            _self.fromFoldItemId = id;

            $(content).find("span:nth-last-child(1)");

            if (!id) {
                id = $(target).attr("id");
            }

            if (!id) {
                return;
            }
            _self.fromFoldWrap =_self.getWrapDomRangeByPosition(e.clientX, e.clientY);;

            var title = _self.locationData[id].name;

            html = "<div class='drag-enlarge-bg' data-target-id='" + id + "'><div class='header'></div><div class='drag-enlarge-content'>" +
            "</div><div class='title'>" + title + "</div><div class='footer'></div></div>";

            $("body").append(html);

            if (_self.fontSize && _self.fontSize != "") {
                $("body .drag-enlarge-bg .title").css({"font-size": _self.fontSize});
            }

            var subWrap = "<div class='wrap'><span id='fold_wrap_1' ></span><span id='fold_wrap_2'></span>" +
                "<span id='fold_wrap_3'></span><span id='fold_wrap_4'></span><span id='fold_wrap_5'>" +
                "</span><span id='fold_wrap_6'></span><span id='fold_wrap_7'></span><span id='fold_wrap_8'>" +
                "</span><span id='fold_wrap_9'></span></div>"

            $(".drag-enlarge-bg .drag-enlarge-content").append(content).append(subWrap);

            var pageCount = $(".drag-enlarge-bg .drag-enlarge-content").find(".data-div").length;

            var pageString = "<div class='drag-page'>";

            for (var i = 0; i < pageCount; i++) {

                pageString += "<span ></span>";
            }
            pageString += "</div>";
            $(".drag-enlarge-bg .drag-enlarge-content").append(pageString);

            $(".drag-enlarge-bg .drag-enlarge-content .data-div:first-child").show().siblings(".data-div").hide();

            $(".drag-enlarge-bg .drag-enlarge-content .drag-page span:first-child").addClass("ative");

            var $dataPages = $(".drag-enlarge-bg .drag-enlarge-content .data-div");
            //创建记录文件夹中wrap与各项数据的变量_self.foldWrapDataItems
            //结构如下：_self.foldWrapDataItems={"name1":{id:id,position:position,items:[]}}

            if ($dataPages && $dataPages.length > 0) {
                _self.foldWrapDataItems = {};
                _self.foldWrapLefts = ["2%", "35%", "68%"];
                _self.foldWrapTops = ["2%", "31%", "60%"];
                for (var i = 0; i < 9; i++) {
                    var wrapid = "fold_wrap_" + (i + 1).toString();
                    _self.foldWrapDataItems[wrapid] = {};
                    _self.foldWrapDataItems[wrapid].id = wrapid;
                    _self.foldWrapDataItems[wrapid].items = [];
                    _self.foldWrapDataItems[wrapid].position = {};
                    var wrapLeft = _self.foldWrapLefts[i % 3];
                    var wrapTop = _self.foldWrapTops[0];
                    if (i > 2 && i <= 5) {
                        wrapTop = _self.foldWrapTops[1];
                    }
                    else if (i > 5 && i < 9) {
                        wrapTop = _self.foldWrapTops[2];
                    }
                    _self.foldWrapDataItems[wrapid].position = {"left": wrapLeft, "top": wrapTop};
                }

                for (var i = 0; i < $dataPages.length; i++) {
                    var pageIndex = $($dataPages[i]).attr("data-page");
                    var dataItems = $($dataPages[i]).find(".data-item");
                    var position = {};
                    for (var j = 0; j < dataItems.length; j++) {
                        var id = $(dataItems[j]).attr("id");
                        _self.foldWrapDataItems["fold_wrap_" + (j + 1).toString()].items.push({
                            "page": (i + 1).toString(),
                            "id": id
                        });
                    }
                }

            }


            $(".drag-enlarge-bg .drag-enlarge-content > .item-title").remove();

            $(".drag-enlarge-bg .drag-enlarge-content").append("<div class='drag-enlarge-content-border'></div>")

            $(".drag-enlarge-bg .drag-enlarge-content .wrap").on("touchstart", function (e) {
                _self.startPageMoveX = e.touches[0].pageX;
                _self.startPageMoveY = e.touches[0].pageY;



            }).on("touchend", function (e) {
                _self.foldPageMove(e);//换页
            });
            $(".drag-enlarge-bg .header,.drag-enlarge-bg .footer").on("click", function () {
                _self.closeDragEnlarge();
            });
            $(".drag-enlarge-content .wrap span").on("touchstart", function (e) {
                _self.foldItemTouchStart(this, e);
            }).on("touchmove", function (e) {
                _self.foldItemTouchMove(this, e);
            }).on("touchend", function (e) {
                _self.foldItemTouchedEnd(this, e);
            });
        }

        /*****
         * 初始化图标的的事件逻辑
         */
        this.initEvent = function () {
            var items = $(_self).find(".drag-panel-container .data-div .data-item").on("touchstart", function (e) {
                _self.dataItemTouchStart(this, e);
            }).on("touchmove", function (e) {
                _self.dataItemTouchMove(this, e);
            }).on("touchend", function (e) {
                _self.dataItemTouchend(this, e);
            });

            $(_self).find(".drag-panel-container .drag-page span").on("click", function () {

                console.log(" $(_self).find(\".drag-panel-container .drag-page span\").on(\"click\", function ()");
                var pageIndex = $(this).attr("data-page");
                _self.turnToPage(pageIndex);
            });

            $(_self).find(".drag-panel-container .page-move-bg").on("touchstart", function (e) {

                _self.startPageMoveX = e.touches[0].pageX;
                _self.startPageMoveY = e.touches[0].pageY;

            }).on("touchend", function (e) {
                _self.endPageMoveX = e.changedTouches[0].pageX;
                _self.endPageMoveY = e.changedTouches[0].pageY;
                var moveDir = _self.getMoveDirection(_self.startPageMoveX, _self.startPageMoveY, _self.endPageMoveX, _self.endPageMoveY);
                _self.currentPage = _self.currentPage || 1;
                switch (moveDir) {
                    case "left"://左滑动前一页
                        if (_self.currentPage < _self.totalPage) {
                            _self.currentPage++;
                            _self.turnToPage(_self.currentPage);
                        }
                        break;
                    case "right"://右滑动下一页
                        if (_self.currentPage > 1) {
                            _self.currentPage--;
                            _self.turnToPage(_self.currentPage);
                        }
                        break;
                }
            });
            $(_self).find(".drag-panel-container .fold").on("click", function (e) {
                _self.foldOnclick(this, e);
            });
        };

        /****
         * 构建一页的数据，进行分页数据的封装
         * @param pageIndex 第几页
         * @param dataArray 此页的数据
         * @param customWidth 将插件的每一项的长度传入
         * @param customHeight 将插件的每一项的高度传入
         * @param perDivsionColWidth 将插件的水平方向每一项的间隔传入
         * @param perDivisonRowHeight 将插件的垂直方向每一项的间隔传入
         */
        this.initOnePageData = function (pageIndex, dataArray, customWidth,
                                         customHeight, perDivsionColWidth, perDivisonRowHeight) {

            var $dragPanelContainer = $(_self).find(".drag-panel-container");

            if (!_self.locationData) {
                _self.locationData = {};//记录位置的数据
            }
            $($dragPanelContainer).append("<div class='data-div' data-page='" + pageIndex + "'></div>");

            var $dataDiv = $($dragPanelContainer).find(".data-div:last-child");//获取最后一个，也就是刚刚才append进去的那个

            var top = perDivisonRowHeight;
            var left = perDivsionColWidth;
            var tmpStyle = "width:" + customWidth + "px;height:" + customHeight + "px;";
            if (_self.borderRadius && _self.borderRadius != "") {
                tmpStyle += "border-radius:" + _self.borderRadius + ";";
            }
            var imageDivHeighStyle = _self.imageHeight && _self.imageHeight != "" ? " height:" + _self.imageHeight + ";" : "height:80%;";//默认为80%
            var id = "";
            for (var i = 0; i < dataArray.length; i++) {
                if (i != 0 && i % _self.col == 0) {
                    //换行处理
                    left = perDivsionColWidth;
                    top += customHeight + perDivisonRowHeight;
                }
                var style = tmpStyle + 'left:' + left + 'px;top:' + top + 'px;';
                var dataType = dataArray[i].type || "data";

                id = pageIndex.toString() + "_data-item_" + (i + 1).toString();//id 为第几页的第几个元素
                dataArray[i].id = id;
                var dataitem = "<div class='data-item' data-type='" + dataType + "'  style=" + style + " id=" + id + ">" +
                    "<div class='image' style='" + imageDivHeighStyle + " background-image: url(" + dataArray[i].img + ")'></div>" +
                    "<span class='item-title'>" + dataArray[i].name + "</span>"
                    + "</div>";
                if (dataType == "fold") {

                    dataitem = "<div class='data-item' data-type='" + dataType + "' style=" + style + " id=" + id + ">" +
                    "<div class='fold' style='" + imageDivHeighStyle + " '></div>" +
                    "<span>" + dataArray[i].name + "</span>"
                    + "</div>";
                }
                $($dataDiv).append(dataitem);

                //记录好位置，虽然id不会再发生变化，但是位置还是会发生变化,如果有parentid说明其在文件夹中，并且记录的是
                //文件夹的id
                _self.locationData[id] = {
                    "page": pageIndex,
                    "parentid": "",
                    "position": {"left": left, "top": top},
                    "img": dataArray[i].img,
                    "name": dataArray[i].name
                };

                left += customWidth + perDivsionColWidth;

                var wrapItemName = "wrap-item-" + (i + 1).toString();

                if (_self.wrapDataItems) {

                    if (!_self.wrapDataItems[wrapItemName]) {
                        _self.wrapDataItems[wrapItemName] = [];
                    }

                    //该变量在移动位置固定时候需要进行修改，记录每一项数据的位置
                    _self.wrapDataItems[wrapItemName].push({"page": pageIndex, "type": dataType, "id": id});
                }
                else {
                    _self.wrapDataItems = {};
                    _self.wrapDataItems[wrapItemName] = [];
                    _self.wrapDataItems[wrapItemName].push({"page": pageIndex, "type": dataType, "id": id});
                }
                if (dataType == "fold" && dataArray[i].childs && dataArray[i].childs.length > 0) {
                    var childHtml = "";
                    var subPage = 0;
                    var subId = "";

                    for (var j = 0; j < dataArray[i].childs.length; j++) {
                        subId = pageIndex.toString() + "_" + (i + 1).toString() + "_sub-data-item_" + (j + 1).toString();

                        if (j % 9 == 0 && j != 0) {
                            childHtml += "</div>"
                        }
                        if (j % 9 == 0) {
                            childHtml += "<div class='data-div' data-page='" + (++subPage).toString() + "'>"
                        }
                        childHtml += "<div class='data-item' data-type=\"data\" id='" + subId + "'>"
                        + "<div class='image' style='background-image: url(" + dataArray[i].childs[j].img + ")'></div>"
                        + "<span>" + dataArray[i].childs[j].name + "</span></div>";

                        if (j == dataArray[i].childs.length - 1 && j % 9 != 0) {
                            childHtml += "</div>"
                        }

                        //记录好位置，虽然id不会再发生变化，但是位置还是会发生变化,如果有parentid说明其在文件夹中，并且记录的是
                        //文件夹的id
                        _self.locationData[subId] = {
                            "page": pageIndex,
                            "parentid": id,
                            "position": {"left": 0, "top": 0},
                            "img": dataArray[i].childs[j].img,
                            "name": dataArray[i].childs[j].name
                        };
                    }

                    if (!_self["childHtmls"]) {
                        _self["childHtmls"] = {};
                    }
                    _self["childHtmls"][id] = {id: id, html: childHtml};

                }
            }
            if (pageIndex != 1) {
                $($dataDiv).hide();
            }

        };
        /***
         * 整个封面的页面初始化
         */
        this.initPage = function () {
            //一共有多少页面的数据
            var countPage = Math.ceil(_self.data.length / (_self.col * _self.row));
            _self.totalPage = countPage;
            var pageItem = "";
            for (var i = 0; i < countPage; i++) {
                pageItem += "<span data-page='" + (i + 1).toString() + "'></span>";
            }

            var pageString = "<div class='drag-page'>" + pageItem + "</div>"


            $(_self).find(".drag-panel-container").append("<div class='page-move-bg'></div>");
            $(_self).find(".drag-panel-container .page-move-bg").append(pageString);
            $(_self).find(".drag-panel-container .drag-page span:first-child").addClass("ative");
        }

        /***
         * 初始化数据结构
         * @param customWidth
         * @param customHeight
         * @param perDivsionColWidth
         * @param perDivisonRowHeight
         */
        this.initData = function (customWidth, customHeight, perDivsionColWidth, perDivisonRowHeight) {
            if (_self.data && _self.data.length > 0) {

                //超出一页面的布局
                if (_self.data.length > _self.col * _self.row) {
                    var pageIndex = 1;
                    var tmpDataArray = new Array();
                    var pageNum = _self.col * _self.row;

                    for (var i = 0; i < _self.data.length; i++) {
                        tmpDataArray.push(_self.data[i]);
                        if (i != 0 && i % pageNum == pageNum - 1) {
                            _self.initOnePageData(pageIndex, tmpDataArray, customWidth, customHeight, perDivsionColWidth, perDivisonRowHeight);
                            pageIndex++;
                            tmpDataArray = new Array();
                        }
                        else if (i == _self.data.length - 1 && tmpDataArray.length > 0) {
                            //最后一页
                            _self.initOnePageData(pageIndex, tmpDataArray, customWidth, customHeight, perDivsionColWidth, perDivisonRowHeight);
                        }
                    }
                    //初始化数据结构
                    _self.initPage();

                }
                else {
                    //只有一页时的封面初始化
                    _self.initOnePageData(1, _self.data, customWidth, customHeight, perDivsionColWidth, perDivisonRowHeight);
                }
                //整个页面的事件初始化
                _self.initEvent();
            }
        };

        /****
         * 初始化containerdiv,布满全屏的div，每一个div有自己独立的固定位置，当
         */
        this.initContainerDiv = function () {
            if (_self.data && _self.data.length > 0) {
                $(_self).append("<div class='drag-panel-container'><div class='wrap'></div></div>");
                if (_self.fontSize && _self.fontSize != "") {
                    $(_self).find(".drag-panel-container").css({"font-size": _self.fontSize});
                }
                var width = $(_self).width();
                var height = $(_self).height();
                var pageHeight = 0;
                if (_self.pageHeight.indexOf('%') > -1) {
                    if (_self.pageHeight.replace("%", "") >= 99 || _self.pageHeight.replace("%", "") < 0) {
                        pageHeight = 0.2;
                    }
                    else {
                        pageHeight = _self.pageHeight.replace("%", "") / 100;
                    }
                    pageHeight = parseInt(height * pageHeight);
                }
                else if (_self.pageHeight.indexOf('px') > -1) {
                    pageHeight = _self.pageHeight.replace("px", "") - 0;
                }

                height = height - pageHeight;//可以布局的高度进行减少用于分页的div高度

                var perWidth = parseInt(width / _self.col);
                var perHeight = parseInt(height / _self.row);

                var customWidth = 0;
                var customHeight = 0;
                if (_self.width.indexOf('%') > -1) {
                    if (_self.width.replace("%", "") >= 100 || _self.width.replace("%", "") <= 0) {
                        customWidth = 0.99;//指定的宽度不能大于100% 及 小于0
                    }
                    else {
                        customWidth = _self.width.replace("%", "") / 100;
                    }
                    customWidth = perWidth * customWidth;
                } else if (_self.width.indexOf('px') > -1) {
                    customWidth = _self.width.replace("px", "") - 0;
                }

                if (_self.height.indexOf('%') > -1) {
                    if (_self.height.replace("%", "") >= 100 || _self.height.replace("%", "") <= 0) {
                        customHeight = 0.99;//指定的宽度不能大于100% 及 小于0
                    }
                    else {
                        customHeight = _self.height.replace("%", "") / 100;
                    }
                    customHeight = perHeight * customHeight;
                } else if (_self.height.indexOf('px') > -1) {
                    customHeight = _self.height.replace("px", "") - 0;
                }

                var divisionColNumber = _self.col + 1;//分隔栏为几个加1 列
                var divisionRowNumber = _self.row + 1;//分隔栏为几个加1 行
                customWidth = parseInt(customWidth);
                customHeight = parseInt(customHeight);

                var perDivsionColWidth = (width - customWidth * _self.col) / divisionColNumber;
                var perDivisonRowHeight = (height - customHeight * _self.row) / divisionRowNumber;

                perDivsionColWidth = parseInt(perDivsionColWidth);
                perDivisonRowHeight = parseInt(perDivisonRowHeight);

                var $dragPanel = $(_self).find(".drag-panel-container .wrap");

                var top = perDivisonRowHeight;
                var left = perDivsionColWidth;
                var style = "width:" + customWidth + "px;height:" + customHeight + "px;";
                if (_self.borderRadius && _self.borderRadius != "") {
                    style += "border-radius:" + _self.borderRadius + ";";
                }
                _self.wrapItems = [];
                var index = 1;
                var wrapitemid = "";
                for (var i = 0; i < _self.row; i++) {
                    left = perDivsionColWidth;

                    for (var j = 0; j < _self.col; j++) {
                        style += 'left:' + left + 'px;top:' + top + 'px;';
                        wrapitemid = "wrap-item-" + index + "";
                        $($dragPanel).append("<div id=" + wrapitemid + " class='wrap-item' style=" + style + "></div>");

                        _self.wrapItems.push({id: wrapitemid, position: {left: left, top: top}});//做定位变量缓存，不需要
                        //每次从document 中查找
                        left += customWidth + perDivsionColWidth;

                        index++;
                    }
                    top += customHeight + perDivisonRowHeight;
                }

                _self.doMessage = "initContainerDiv success";
                _self.customWidth = customWidth;
                _self.customHeight = customHeight;
                _self.initData(customWidth, customHeight, perDivsionColWidth, perDivisonRowHeight);

                //因为在touchmove事件中新增的节点不能进行移动，新增一个临时的模拟移动的节点
                var $cloneMoveItem = $("<div class='clone-move-item data-item'></div>");
                $cloneMoveItem.css({
                    "width": customWidth + "px",
                    "height": customHeight + "px",
                    "border-radius": _self.borderRadius
                });
                var $dragPanelContainer = $(_self).find(".drag-panel-container");
                $($dragPanelContainer).append($cloneMoveItem);

                if (_self["childHtmls"]) {
                    for (var i in _self["childHtmls"]) {
                        var id = _self["childHtmls"][i].id;
                        var html = _self["childHtmls"][i].html;

                        $("#" + id).find(".fold").html(html);
                    }
                }
            }
            else {
                _self.doMessage = "must need data params";
            }
        }();//自执行方法,是整个插件的起始，嘟嘟，跑呀跑
    }

}, "DragManager");

