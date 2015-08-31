$(function(){
    var pagination = function(articles, perPage) {
        // Prepare initial variables and setup
        $("#footer").before("<div id='pagination'></div>");
        var $sidebar = $("#articles-sidebar"),
            $sidebarDown = $("#articles-sidebar-item-bottom"),
            $pagination = $("#pagination"),
            hashPage = null,
            pages = Math.floor(articles.length / perPage);
        if (articles.length % perPage !== 0) {
            pages++;
        }
        for (var i = 1; i <= pages; i++) {
            $pagination.append("<span class='pagination-page'>" + i + "</span>");
        }

        // Set the active page in the sidebar
        var setActivePost = function() {
            if($(window).scrollTop() + $(window).height() > $(document).height() - 20) {
                $("#articles-sidebar .articles-sidebar-item").removeClass("active");
                $("#articles-sidebar-item-bottom").addClass("active");
            } else {
                $("#articles-sidebar-item-bottom").removeClass("active");
                if ($(window).scrollTop() < 51) {
                    $($("#articles-sidebar .articles-sidebar-item")[0]).addClass("active");
                } else {
                    var children = $(".article.show").children(".article-header").children("a").children("h1");
                    for (var i = 0; i < children.length; i++) {
                        var child = children[i];
                        if (($(child).position().top - 27) < $(window).scrollTop()) {
                            $("#articles-sidebar .articles-sidebar-item").removeClass("active");
                            $($("#articles-sidebar .articles-sidebar-item")[i]).addClass("active");
                        }
                    }
                }
            }
        };

        // Activate a pagination element
        var activatePage = function(elem) {
            var page = $(elem).html(),
                offset = (page * perPage) - perPage;
            $("#articles-sidebar .articles-sidebar-item").remove(); // clear the sidebar
            for (var i = 0; i < articles.length; i++) {
                if (i < offset || i >= offset + perPage) {
                    $(articles[i]).removeClass("show last").addClass("hidden");
                } else {
                    var $articleHeader = $($(".article-header h1", articles[i])[0]);
                    $sidebarDown.before("<div class='articles-sidebar-item'>" + $articleHeader.html() + "</div>"); // this is for the sidebar
                    $(articles[i]).removeClass("hidden last").addClass("show");
                    if (i == offset + perPage - 1 || i == articles.length - 1) {
                        $(articles[i]).addClass("last");
                    }
                }
            }
            $("#pagination .pagination-page").removeClass("active");
            $(elem).addClass("active");
            $("html, body").animate({ scrollTop: 0 }, 200);
            window.location.hash = "!/" + page;
            setActivePost();
        };
        $("#pagination").on("click", ".pagination-page", function() {
            activatePage(this);
        });

        // Handle the hash, activating pagination elements etc
        var handleHash = function(hash) {
            var urlHash = window.location.hash,
                newHashPage = null;
            if (urlHash.substr(3) > 0 && urlHash.substr(3) <= pages) {
                newHashPage = urlHash.substr(3) - 1;
            }
            if (newHashPage !== null && hashPage != newHashPage) {
                hashPage = newHashPage;
                activatePage($("#pagination .pagination-page")[hashPage]);
            } else if (hashPage === null) {
                activatePage($("#pagination .pagination-page")[0]);
            }
        };

        // Check for hash changes
        var hashCheck = function() {
            setTimeout(function() {
                handleHash();
                hashCheck();
            }, 500);
        };
        handleHash();
        hashCheck();

        $(window).scroll(function() {
            setActivePost();
        });
        setActivePost();
        $("#articles-sidebar-item-bottom").on("click", function() {
            if ($("#articles-sidebar-item-bottom").hasClass("active")) {
                $("html, body").animate({ scrollTop: 0 }, 200);
            } else {
                $("html, body").animate({ scrollTop: $(document).height() }, 200);
            }
        });
        $("#articles-sidebar").on("click", ".articles-sidebar-item", function() {
            var index = $("#articles-sidebar .articles-sidebar-item").index(this);
            $("html, body").animate({ scrollTop: $($(".article.show")[index]).position().top }, 200);
        });
    };

    var Articles = $("#content .article");
    var ArticlesPerPage = 3;
    if (Articles.length > 0) {
        pagination(Articles, ArticlesPerPage);
    }
    $("#articles-sidebar").removeClass("hide");
});
