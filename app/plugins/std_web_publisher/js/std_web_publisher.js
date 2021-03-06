/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Private platform APIs
var Exchange = $Exchange;
var GenericDeferredRender = $GenericDeferredRender;

// --------------------------------------------------------------------------

var renderingContext;
P.getRenderingContext = function() { return renderingContext; };

// --------------------------------------------------------------------------

// Platform support
P.$webPublisherHandle = function(host, method, path) {
    var publication = publications[host.toLowerCase()] || publications[DEFAULT];
    if(!publication) { return null; }
    renderingContext = new RenderingContext(publication);
    try {
        return publication._handleRequest(method, path);
    } finally {
        renderingContext = undefined;
    }
};

P.$generateRobotsTxt = function(host) {
    var publication = publications[host.toLowerCase()] || publications[DEFAULT];
    return publication ? publication._generateRobotsTxt() : null;
};

P.$renderObjectValue = function(object) {
    var href;
    if(renderingContext) {
        href = renderingContext.publication._urlPathForObject(object);
    }
    return P.template("object/link").render({
        href: href,
        title: object.title
    });
};

P.$isRenderingForWebPublisher = function() {
    return !!renderingContext;
};

P.$renderFileIdentifierValue = function(fileIdentifier) {
    return renderingContext.publication._renderFileIdentifierValue(fileIdentifier);
};

// --------------------------------------------------------------------------

P.onLoad = function() {
    P.setupPageParts();
};

// --------------------------------------------------------------------------

var publisherFeatures = {}; // name -> function(publication)

var publications = P.allPublications = {};

var DEFAULT = "$default$";

P.FEATURE = {
    DEFAULT: DEFAULT,
    register: function(name) {
        if(typeof(name) !== "string") {
            throw new Error("Name passed to P.webPublication.register() must be a hostname or P.webPublication.DEFAULT");
        }
        if(name in publications) {
            throw new Error(
                (name === DEFAULT) ? "Default publication already registered." : "Publication "+name+" already registered."
            );
        }
        var publication = new Publication(name, this.$plugin);
        publications[name] = publication;
        return publication;
    },
    feature: function(name, feature) {
        if(name in publisherFeatures) { throw new Error("Feature '"+name+"' already registered"); }
        publisherFeatures[name] = feature;
    }
};
var ConsumerFeature = function(plugin) { this.$plugin = plugin; };
ConsumerFeature.prototype = P.FEATURE;

P.WIDGETS = {};
var Widgets = function(plugin) { this.$plugin = plugin; };
Widgets.prototype = P.WIDGETS;

P.provideFeature("std:web-publisher", function(plugin) {
    var consumerFeature = new ConsumerFeature(plugin);
    consumerFeature.widget = new Widgets(plugin);
    plugin.webPublication = consumerFeature;
});

// --------------------------------------------------------------------------

var ACCEPTABLE_PATH = /^\/(|[a-z0-9\/\-]*[a-z0-9\-])\/?$/;

var checkHandlerArgs = function(path, handlerFunction) {
    if(!(path && path.match(ACCEPTABLE_PATH))) {
        throw new Error("Web published path is not acceptable: "+path);
    }
    if(typeof(handlerFunction) !== "function") {
        throw new Error("Web publisher handlers must be functions");
    }
};

// --------------------------------------------------------------------------

var Publication = P.Publication = function(name, plugin) {
    this.name = name;
    this.implementingPlugin = plugin;
    this._homePageUrlPath = null;
    this._pagePartOptions = {};
    this._paths = [];
    this._objectTypeHandler = O.refdictHierarchical();
    this._searchResultsRenderers = O.refdictHierarchical(); // also this._defaultSearchResultRenderer
    this._setupForFileDownloads();
};

Publication.prototype.DEFAULT = {};

// NOTE: API for file downloads implemented in std_web_publisher_files.js

Publication.prototype.use = function(name /* arguments */) {
    var feature = publisherFeatures[name];
    if(!feature) { throw new Error("No web publisher feature: "+name); }
    // Copy arguments, replace name with this publication, call feature function to let it set up the feature
    var featureArguments = Array.prototype.slice.call(arguments, 0);
    featureArguments[0] = this;
    feature.apply(this, featureArguments);
    return this;
};

Publication.prototype.serviceUser = function(serviceUserCode) {
    if(typeof(serviceUserCode) !== "string") { throw new Error("serviceUser() must take an API code as a string"); }
    this._serviceUserCode = serviceUserCode;
    return this;
};

// NOTE: Can also be set on per-request basis in RenderingContext
Publication.prototype.setPagePartOptions = function(pagePartName, options) {
    this._pagePartOptions[pagePartName] = options || {};
    return this;
};

// Set a home page
Publication.prototype.setHomePageUrlPath = function(urlPath) {
    this._homePageUrlPath = urlPath;
    return this;
};

// Register a function to render a layout around HTML pages: layoutRenderer(E, context, blocks)
// Blocks contains deferred renders for parts of page. Will contain 'body', may contain 'sidebar'.
// NOTE: pageTitle from template can be obtained through the context object
Publication.prototype.layout = function(layoutRenderer) {
    this._layoutRenderer = layoutRenderer;
};

Publication.prototype._respondToExactPath = function(allowPOST, path, handlerFunction) {
    checkHandlerArgs(path, handlerFunction);
    this._paths.push({
        path: path,
        allowPOST: allowPOST,
        robotsTxtAllowPath: path,
        matches: function(t) { return t === path; },
        fn: handlerFunction
    });
};
Publication.prototype.respondToExactPath = function(path, handlerFunction) {
    return this._respondToExactPath(false, path, handlerFunction);
};
Publication.prototype.respondToExactPathAllowingPOST = function(path, handlerFunction) {
    return this._respondToExactPath(true, path, handlerFunction);
};

Publication.prototype._respondToDirectory = function(allowPOST, path, handlerFunction) {
    checkHandlerArgs(path, handlerFunction);
    var pathPrefix = path+"/";
    this._paths.push({
        path: path,
        allowPOST: allowPOST,
        robotsTxtAllowPath: pathPrefix,
        matches: function(t) { return t.startsWith(pathPrefix); },
        fn: handlerFunction
    });
};
Publication.prototype.respondToDirectory = function(path, handlerFunction) {
    return this._respondToDirectory(false, path, handlerFunction);
};
Publication.prototype.respondToDirectoryAllowingPOST = function(path, handlerFunction) {
    return this._respondToDirectory(true, path, handlerFunction);
};

Publication.prototype.respondWithObject = function(path, types, handlerFunction) {
    checkHandlerArgs(path, handlerFunction);
    var allowedTypes = O.refdictHierarchical();
    var pathPrefix = path+"/";
    var handler = {
        path: path,
        robotsTxtAllowPath: pathPrefix,
        matches: function(t) { return t.startsWith(pathPrefix); },
        fn: function(E) {
            var ref, pe = E.request.extraPathElements;
            if(!(pe.length && (ref = O.ref(pe[0])))) {
                return null;
            }
            if(!O.currentUser.canRead(ref)) {
                console.log("Web publisher: user not allowed to read", ref);
                return null;    // 404 if user can't read object
            }
            var object = ref.load();
            // Check object is correct type, and 404 if not
            if(!allowedTypes.get(object.firstType())) {
                console.log("Web publisher: object has wrong type for this path", object);
                return null;
            }
            renderingContext.object = object;    // allow Page Parts to get the object we're rendering
            return handlerFunction(E, renderingContext, object);
        },
        urlForObject: function(object) {
            return path+"/"+object.ref+"/"+object.title.toLowerCase().replace(/[^a-z0-9]+/g,'-');
        }
    };
    var objectTypeHandler = this._objectTypeHandler;
    types.forEach(function(type) {
        allowedTypes.set(type, true); // for checking
        objectTypeHandler.set(type, handler);   // for lookups by object type
    });
    this._paths.push(handler);
};

Publication.prototype.searchResultRendererForTypes = function(types, renderer) {
    if(types === this.DEFAULT) {
        this._defaultSearchResultRenderer = renderer;
    } else {
        var renderers = this._searchResultsRenderers;
        _.each(types, function(type) {
            renderers.set(type, renderer);
        });
    }
};

// --------------------------------------------------------------------------

// Passed to all handler functions as second argument
var RenderingContext = function(publication) {
    this.publication = publication;
    this.hint = {};
    this._pagePartOptions = {};
};

// Properties:
//      publication
//      hint  (used for passing info to the layout, NOT for passing info to page parts, which should use options)
//      object  (when rendering an object)
//      pageTitle  (when rendering a layout, if specified by the E.render() view)

RenderingContext.prototype.publishedObjectUrl = function(object) {
    return this.publication.urlForObject(object);
};
RenderingContext.prototype.publishedObjectUrlPath = function(object) {
    return this.publication._urlPathForObject(object);
};

// NOTE: Can also be set on the publication
RenderingContext.prototype.setPagePartOptions = function(pagePartName, options) {
    this._pagePartOptions[pagePartName] = options || {};
    return this;
};

// --------------------------------------------------------------------------

Publication.prototype._handleRequest = function(method, path) {
    if(!this._serviceUserCode) { throw new Error("serviceUser() must have been called during publication configuration to set a service user."); }
    var publication = this;
    return O.impersonating(O.serviceUser(this._serviceUserCode), function() {
        return publication._handleRequest2(method, path);
    });
};

Publication.prototype._handleRequest2 = function(method, path) {
    // Find handler from paths this publication responds to:
    var handler;
    for(var l = 0; l < this._paths.length; ++l) {
        var h = this._paths[l];
        if(h.matches(path)) {
            handler = h;
            break;
        }
    }
    if(!handler) { return null; }
    if(method !== "GET") {
        if(!(handler.allowPOST)) {
            return null; // TODO: Nicer error page
        }
    }
    // Set up exchange and call handler
    var pathElements = path.substring(handler.path.length+1).split('/');
    var E = new Exchange(this.implementingPlugin, handler.path, method, path, pathElements);
    renderingContext.$E = E;
    handler.fn(E, renderingContext);
    if(!E.response.body) {
        return null;    // 404
    }
    if(this._layoutRenderer && E.response.kind === "html") {
        renderingContext.pageTitle = E.response.pageTitle;
        var fn = this._layoutRenderer;
        var blocks = {
            body: new GenericDeferredRender(function() { return E.response.body; })
        };
        var sidebarHTML = $host.getRightColumnHTML();
        if(sidebarHTML) { blocks.sidebar = new GenericDeferredRender(function() { return sidebarHTML; }); }
        var renderedWithLayout = fn(E, renderingContext, blocks);
        if(renderedWithLayout) {
            E.response.body = renderedWithLayout;
        }
    }
    E.response.headers["Server"] = "Haplo Web Publisher";
    O.serviceMaybe("std:web-publisher:observe:request", this, E, renderingContext);
    return E.response;
};

Publication.prototype._urlPathForObject = function(object) {
    var handler = this._objectTypeHandler.get(object.firstType());
    if(handler) {
        return handler.urlForObject(object);
    }
};

Publication.prototype.__defineGetter__("urlHostname", function() {
    return (this.name === DEFAULT) ?
        O.application.hostname :
        this.name;
});

Publication.prototype.urlForObject = function(object) {
    var path = this._urlPathForObject(object);
    if(!path) { return; }
    return 'https://'+this.urlHostname+path;
};

Publication.prototype._generateRobotsTxt = function() {
    var lines = ["User-agent: *"];
    for(var l = 0; l < this._paths.length; ++l) {
        var allow = this._paths[l].robotsTxtAllowPath;
        if(allow) {
            lines.push("Allow: "+allow);
        }
    }
    lines.push("Disallow: /", "");  // must be last for maximum compatibility
    return lines.join("\n");
};
