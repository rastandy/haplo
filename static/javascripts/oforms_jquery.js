/* Haplo Platform                                     http://haplo.org
 * (c) ONEIS Ltd 2006 - 2015                    http://www.oneis.co.uk
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/* *********************************************
 *
 *  DO NOT MAKE CHANGES TO THIS FILE
 *
 *  UPDATE FROM THE OFORMS DISTRIBUTION USING
 *
 *    lib/tasks/update_oforms.sh
 *
 * ********************************************* */

/*! oForms | (c) ONEIS Ltd 2012 | MIT License */

/////////////////////////////// jquery_preamble.js ///////////////////////////////

(function(root, $ /* jQuery */) {

// Bundles generated by the server (or on the client if the forms system is running client side)
var registeredBundles = {};

// Create the interface for the client side
if(undefined === root.oForms) {
    root.oForms = {};
}
root.oForms.client = {
    registerBundle: function(id, bundle) {
        registeredBundles[id] = bundle;
    }
};

// List of functions to call when initialising a new repeating section element
var onCreateNewRepeatingSectionRow = [];

/////////////////////////////// ui_utils.js ///////////////////////////////

// Utility functions for client side support code

var escapeHTML = function(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

var trimWhitespace = function(str) {
    return str.replace(/^\s+/,'').replace(/\s+$/,'');
};

var padZeros = function(n, len) {
    var s = ''+n;
    while(s.length < len) { s = '0'+s; }
    return s;
};


// Functions to extract parts from element names.
//
// Element names are encoded as:
//
//   name[.part][.suffix]
//
// where name is a-z0-9_ only,
// part is optional, and a-z only, used for distinguising multiple elements within a form,
// and suffix is a dot separated list of 0-9 only, used for repeated sections.

var elementBaseName = function(name) {
    var i = name.indexOf('.');
    return (-1 === i) ? name : name.substr(0, i);
};

var elementNameSuffix = function(name) {
    var m = name.match(/\.[0-9\.]+$/);
    return m ? m[0] : '';
};


// DOM manipulation

var positionClone = function(element, reference, dx, dy, setWidth, setHeight) {
    // Get basic info about the reference element
    var refq = $(reference).first();
    if(refq.length === 0) { return; } // abort if the reference element can't be found
    var pos = refq.offset();
    // Adjust the position using the offsets
    pos.left += dx || 0;
    pos.top += dy || 0;
    // Set left and top in the CSS so this can be called repeatedly without getting the position wrong
    var css = {left:0, top:0};
    // Set width and height?
    if(setWidth || setHeight) {
        if(setWidth)  { css.width = refq[0].offsetWidth+'px';   }
        if(setHeight) { css.height = refq[0].offsetHeight+'px'; }
    }
    // Show and apply positioning to target element
    $(element).css(css).show().offset(pos);
};

/////////////////////////////// guidance_note_impl.js ///////////////////////////////

// TODO: Guidance notes workaround for IE6 lack of support for position:fixed?

var guidanceNoteWaitingForRemoval;

var guidanceNoteOnBlur = function() {
    if(!guidanceNoteWaitingForRemoval) {
        guidanceNoteWaitingForRemoval = true;
        // Hide guidance notes after a short delay, so that blur & focus events in quick succession
        // don't cause the guidance notes box to flicker.
        window.setTimeout(function() {
            if(guidanceNoteWaitingForRemoval) {
                $('#oforms-guidance-note').hide();
                guidanceNoteWaitingForRemoval = undefined;
            }
        }, 125);
    }
};

var guidanceNoteOnFocus = function() {
    // Does this element have a guidance note, or does a parent of the element?
    var note, scan = this;
    while(!note && scan && scan.className !== 'oform') {
        note = scan.getAttribute('data-oforms-note');
        scan = scan.parentNode;
    }
    // Display or hide the guidance note
    if(note) {
        guidanceNoteWaitingForRemoval = undefined;
        var display;
        while(!display) {
            display = $('#oforms-guidance-note div');
            if(display.length === 0) {
                $(document.body).append('<div id="oforms-guidance-note"><div></div></div>');
                display = undefined;
            }
        }
        display.text(note);
        $('#oforms-guidance-note').show();
    } else {
        // Start process for eventual hiding of the guidance note
        guidanceNoteOnBlur();
    }
};

/////////////////////////////// element_support/preamble.js ///////////////////////////////

$(document).ready(function() {
    // Attach handlers to forms, making the bundle available.
    $('.oform').each(function() {
        // Make sure a bundle is available
        var bundle = registeredBundles[this.id];
        if(undefined === bundle) {
            // No bundle was registered. Make a blank bundle available so that everything else
            // can assume there is a bundle, even if it doesn't contain anything.
            bundle = {
                elements: {}
            };
        }
        // Shortcut for accessing the elements
        var bundledElements = bundle.elements;
        // Make a jQuery object for attaching handlers
        var oform = $(this);

        // Now each of the element support functions will add their handlers with
        //
        //    oform.on(...);
        //
        // and use the variables
        //
        //    bundle
        //    bundledElements
        //
        // to access the information from the server.

        // ...

// This function is terminated in the postamble.js file.

/////////////////////////////// element_support/repeating_section.js ///////////////////////////////

// Attach handlers to forms for repeating sections

// Implement the Add buttons
var repeatingSectionAddRow = function(referenceElement) {
    // Find the repeating section this add button refers to
    var repeatingSection = $(referenceElement).parents(".oforms-repeat").first();   // need to use parents().first() because parent() only looks one level up
    // Find the form element which represents this repeating section in the DOM
    //   - the name is used to determine the name and suffix for the contained elements
    //   - the value contains information about which indicies are in use, reflecting the shadow rows on the server
    var indiciesFormElement = $(".oforms-idx", repeatingSection)[0];
    // Get the bundled information
    var bundled = bundledElements[elementBaseName(indiciesFormElement.name)];
    // Find the list of current row indicies, and determine the new one
    var indiciesInfo = indiciesFormElement.value.split('/'); // indiciesInfo is [version, indicies list, next index]
    var newIndex = indiciesInfo[2] * 1;
    // Update the indicies data hidden form element value
    indiciesInfo[1] += ((indiciesInfo[1].length > 0) ? ' ' : '') + newIndex;
    indiciesInfo[2] = newIndex + 1;
    // Check number of rows against bundled.maximumCount
    if(undefined !== bundled.maximumCount) {
        // Count the current number of rows - easier to do it via the indiciesInfo than trying to query the DOM
        var currentRowCount = indiciesInfo[1].split(' ').length;
        if(currentRowCount > bundled.maximumCount) {
            // Too many rows to add a new one - stop now before the DOM is modified.
            return;
        } else if(currentRowCount == bundled.maximumCount) {
            // Will now be at the maximum count, so visually change the style of the add button to show the user.
            $('.oforms-add-btn', repeatingSection).last().addClass('oform-add-btn-disabled');
        }
    }
    // Store the indicies info into the form element, after the maximum length validation has been passed
    indiciesFormElement.value = indiciesInfo.join('/');
    // Find the DOM element where the rows should be inserted
    var rowsParent = $('.oforms-append', repeatingSection).first(); // need first() because of nested repeating sections
    // But if it doesn't have an explicit insertation element, default to the main section element
    if(rowsParent.length === 0) { rowsParent = repeatingSection; }
    // Work out the new suffix
    var suffix = elementNameSuffix(indiciesFormElement.name) + '.' + newIndex;
    // Use the blank HTML from the bundle to create the new DOM elements, rewriting the name attributes to include the generated suffix.
    var newRow = $(bundled.blank);
    $('input,textarea,select', newRow).each(function() {
        this.name = this.name.replace('_!_', suffix);
    });
    // Custom initialisation for any other elements
    _.each(onCreateNewRepeatingSectionRow, function(f) { f.call(this, newRow, rowsParent); });
    // Insert the new row into the DOM
    rowsParent.append(newRow);
    // And return for caller to use
    return newRow;
};

oform.on("click", ".oforms-add-btn", function(event) {
    event.preventDefault();
    repeatingSectionAddRow(this);
});

// Implement the Delete buttons
oform.on("click", ".oforms-delete-btn", function(event) {
    event.preventDefault();
    // Find the row this applies to
    var row = $(this).parents('.oforms-repetition').first();   // need to use parents().first() because parent() only looks one level up
    // Hide it from the user, rather than removing it from the DOM
    row.hide();
    // How many other VISIBLE row elements are there before it?
    var previousCount = row.prevAll(".oforms-repetition:visible").length;
    // Update the row information by removing that row index from the list
    var indiciesFormElement = $(".oforms-idx", $(this).parents(".oforms-repeat").first())[0];
    var indiciesInfo = indiciesFormElement.value.split('/'); // indiciesInfo is [version, indicies list, next index]
    var indicies = indiciesInfo[1].split(' ');
    indicies.splice(previousCount, 1);
    indiciesInfo[1] = indicies.join(' ');
    indiciesFormElement.value = indiciesInfo.join('/');
    // Make sure the Add button doesn't have the disabled style
    $('.oforms-add-btn', $(this).parents('.oforms-repeat').first()).last().removeClass('oform-add-btn-disabled');
});

/////////////////////////////// element_support/choice.js ///////////////////////////////

onCreateNewRepeatingSectionRow.push(function(newRow, rowsParent) {
    // Copy any instance choices
    $('select[data-oforms-need-fill]', newRow).each(function() {
        var sourceName = this.name.replace(/\.\d+/,'.0');
        var options = $($('select[name="'+sourceName+'"]', rowsParent).html());
        options.each(function() {
            if(this.selected) { this.selected = false; }
        });
        $(this).empty().append(options);
    });
});

/////////////////////////////// element_support/lookup.js ///////////////////////////////

// TODO: Keyboard selection of results for lookup elements


// Per-endpoint cache of results
// TODO: Expiring entries from the cache to save memory
var lookupEndpointCache = {};
// Cache entries have keys:
//   _queries - map of query string to response from server
//   _idToDisplay - map of value id to display string, filled in when things are selected

// --------------------------------------------------------------------------------------------------------

// Function to assemble information about the lookup, given a DOM element within the containing SPAN.
var findLookupElementInfo = function(domElement) {
    var containingSpan = $(domElement).parents('.oforms-lookup').first();
    var valueInput = $('input[type=hidden]', containingSpan)[0];
    var name = elementBaseName(valueInput.name);
    var elementInfo = bundledElements[name];
    var dataSource = bundle.dataSource[elementInfo.dataSource];
    var cache = lookupEndpointCache[dataSource.endpoint];
    if(undefined === cache) {
        lookupEndpointCache[dataSource.endpoint] = cache = {_queries:{}, _idToDisplay:{}};
    }
    return {
        _name: name,
        _valueInput: valueInput,
        _containingSpan: containingSpan,
        _dataSource: dataSource,
        _queryCache: cache
    };
};

// --------------------------------------------------------------------------------------------------------

// Handling the result picker
var lookupResultPickerPickedFn; // function to call with index of result

var lookupResultPickerActivateItem = function(item) {
    var index = $(item).prevAll('.item').length;
    if(lookupResultPickerPickedFn) {
        lookupResultPickerPickedFn(index);
        lookupResultPickerPickedFn = undefined;
    }
    lookupResultPickerHide();
};

var lookupResultPickerSelectItem = function(item) {
    $('.item', '#oforms-lookup-picker').removeClass('selected');
    if(item) { $(item).addClass('selected'); }
};

var lookupResultPickerHide = function() {
    $('#oforms-lookup-picker').hide().data('loadedHtml', null);
    lookupResultPickerPickedFn = undefined;
};

// --------------------------------------------------------------------------------------------------------

// When the element is clicked, store the value if it's useful
oform.on('focus', '.oforms-lookup-input', function() {
    var info = findLookupElementInfo(this);
    if($(this).hasClass('oforms-lookup-valid')) {
        // Has valid data, make sure it's cached
        if(undefined === info._queryCache._idToDisplay[info._valueInput.value]) {
            info._queryCache._idToDisplay[info._valueInput.value] = this.value;
        }
    }
});

// --------------------------------------------------------------------------------------------------------

var lookupResultPickerNavigation = {
    38: -1, // Up arrow
    40: 1, // Down arrow
    34: 3, // Page down
    33: -3 // Page up
};
var ENTER_KEY = 13;

// Do result navigation on keydown, to detect key repeats properly
oform.on('keydown', '.oforms-lookup-input', function(event) {
    var picker;
    if(event.which in lookupResultPickerNavigation) {
        var delta = lookupResultPickerNavigation[event.which];
        picker = $('#oforms-lookup-picker');
        var entries = $('.item', picker);
        if(!picker.is(':visible') || entries.length === 0) {
            return;
        }
        var currentPosition = entries.index($('.selected', picker));
        if(currentPosition < 0) {
            currentPosition = (delta < 0) ? entries.length : -1;
        }
        var new_position = currentPosition + delta;
        var clamp = entries.length;
        new_position = ((new_position % clamp) + clamp) % clamp;
        lookupResultPickerSelectItem(entries[new_position]);
        event.preventDefault();
        return false;
    }
    if(event.which === ENTER_KEY) {
        picker = $('#oforms-lookup-picker');
        var selected = $('.selected', picker);
        if(!selected.length){
            return;
        }
        lookupResultPickerActivateItem(selected);
        $(this).keyup();
        event.preventDefault();
        return false;
    }
});

// --------------------------------------------------------------------------------------------------------

// Do queries on keyup so the input value is up-to-date
oform.on('keyup', '.oforms-lookup-input', function(event) {
    if(event.which in lookupResultPickerNavigation) { return; }
    var info = findLookupElementInfo(this);
    var lookupElement = $(this);
    // Clear the value input so invalid data isn't sent to the server
    info._valueInput.value = '';
    lookupElement.removeClass('oforms-lookup-valid');
    // Convert query to lower case and trim leading and trailing whitespace

    var originalValue = lookupElement.val();
    var query = originalValue.toLowerCase().replace(/(^\s+|\s+$)/g,'');
    if(query === '') {
        return lookupResultPickerHide();
    }
    // Cached result?
    var result = info._queryCache._queries[query];
    var useResult = function() {
        var currentValue = lookupElement.val();
        if(result.selectId) {
            // Current text exactly matched a result. Set the field with the id and display text.
            info._valueInput.value = result.selectId;
            info._queryCache._idToDisplay[result.selectId] = result.selectDisplay;
            // Leave the value alone if the input has been changed since the query was sent to the server.
            // If any whitespace exists after the matching value in the original input, append that onto the
            // new value.  This allows users to type to select something when there are two options
            // like "ABC" and "ABC XYZ". Without this logic, it would be impossible to type the space in the
            // latter option.
            if(originalValue.toLowerCase() == currentValue.toLowerCase() && query !== lookupElement.data("lastQuery")) {
                var tail = lookupElement.val().slice(result.selectDisplay.length);
                var newValue = result.selectDisplay + tail;
                lookupElement.val(newValue);
                lookupElement.data("lastQuery", query);
            }
            lookupElement.addClass('oforms-lookup-valid');
            lookupResultPickerHide();
        } else {
            // No exact match - build HTML for the lookup
            var html = [];
            if(result.message) {
                // Display a message from the server instead of the results.
                // Allows the server to set a custom message for when there are no matches.
                html.push('<span class="oforms-lookup-message">', escapeHTML(result.message), '</span>');
            } else {
                // Display the results
                _.each(result.results, function(r) {
                    if(typeof(r) === 'string') {
                        // Just a display string
                        html.push('<span class="item">', escapeHTML(r), '</span>');
                    } else {
                        // Array of [id, display]
                        html.push('<span class="item">', escapeHTML(r[1]), '</span>');
                    }
                });
            }
            // Create picker, or update existing picker element
            var picker = $('#oforms-lookup-picker');
            if(picker.length === 0) {
                // Create the picker
                html.unshift('<div id="oforms-lookup-picker">'); html.push("</div>");
                $(document.body).append(html.join(''));
                picker = $('#oforms-lookup-picker');
                // Register event handler for mousedown, and stop clicks from doing anything.
                picker.on('mousedown', '.item', function(event) {
                    // Don't allow focus to leave the input..
                    event.preventDefault();
                }).on('mouseover', '.item', function(event) {
                    // Like a WIMP menu
                    lookupResultPickerSelectItem(this);
                }).on('mouseup', '.item', function(event) {
                    // Mouseup to allow user to 'change their mind' after clicking, as per standards
                    lookupResultPickerActivateItem(this);
                    event.preventDefault();
                });
            } else {
                // If the content of the picker has changed, then put the html
                // in the picker and display it.
                var content = html.join('');
                if(content !== picker.data('loadedHtml')) {
                    picker.html(content);
                    picker.data('loadedHtml', content);
                }
                // If the input box is now blank (due to delay), then
                // don't show the picker
                if(currentValue.replace(/\s+/g, '') !== '') {
                    picker.show();
                }
            }
            // Position the picker on the page
            positionClone(picker, lookupElement, 0, lookupElement.height() + 3);
            // Store a function for using the result
            lookupResultPickerPickedFn = function(index) {
                var r = result.results[index];
                var id, display;
                if(typeof(r) === 'string') {
                    id = r; display = r;
                } else {
                    id = r[0]; display = r[1];
                }
                info._valueInput.value = id;
                info._queryCache._idToDisplay[id] = display;
                lookupElement.val(display).addClass('oforms-lookup-valid');
            };
        }
    };
    if(result) {
        // Have cached result, use it now
        useResult();
    } else {
        // Fetch the results from the server, then use them
        var url = info._dataSource.endpoint;
        url += ((-1 !== url.indexOf('?')) ? '&q=' : '?q=') + encodeURIComponent(query);
        $.get(url, function(data) {
            result = data;
            info._queryCache._queries[query] = result;
            useResult();
        });
    }
});

// --------------------------------------------------------------------------------------------------------

// Hide the results picker when focus leaves
oform.on('blur', '.oforms-lookup-input', lookupResultPickerHide);


/////////////////////////////// element_support/file.js ///////////////////////////////

// Ignore clicks on the link, just in case they get through
oform.on('click', '.oforms-file-prompt a', function(evt) { evt.preventDefault(); });

// Pass off file choice to client side delegate
oform.on('change', '.oforms-file input[type=file]', function(evt) {
    if(!window.oFormsFileDelegate) { return window.alert("Not supported."); }
    var fileInput = this;
    var fileElement = $(fileInput).parents('.oforms-file').first();
    if(fileInput.files && fileInput.files.length === 1) {
        var file = fileInput.files[0];
        window.oFormsFileDelegate.uploadFile(file, fileElementStartUploadUserInteface(fileElement, file));
    }
    fileInput.value = '';
});

var fileElementStartUploadUserInteface = function(fileElement, file) {
    fileElement.addClass('oforms-file-in-progress');
    $('.oforms-file-remove, .oforms-file-prompt', fileElement).hide();
    $('.oforms-file-display', fileElement).html('<span "oforms-file-starting-upload">Starting upload...</span>');
    // Submit handler on form?
    var form = fileElement.parents('form').first();
    if(form.length && !(form[0].getAttribute('data-oforms-file-support-handled'))) {
        form[0].setAttribute('data-oforms-file-support-handled', '1');
        form.on('submit', function(evt) {
            if($('.oforms-file-in-progress, .oforms-file-error', form).length) {
                evt.preventDefault();
                window.alert("This form cannot be submitted while a file upload is in progress.");
            }
        });
    }
    // Callbacks object
    return {
        updateDisplay: function(html) {
            $('.oforms-file-display', fileElement).html(html);
        },
        onFinish: function(encoded, displayHtml) {
            fileElement.removeClass('oforms-file-in-progress oforms-file-error');
            $('input[type=hidden]', fileElement).val(encoded);
            $('.oforms-file-display', fileElement).html(displayHtml);
            $('.oforms-file-remove', fileElement).show();
        },
        onError: function() {
            fileElement.removeClass('oforms-file-in-progress').addClass('oforms-file-error');
            $('input[type=hidden]', fileElement).val('');
            $('.oforms-file-display', fileElement).html('<span class="oforms-file-error-text">Error uploading file<span>');
            $('.oforms-file-remove', fileElement).show();
        }
    };
};

oform.on('click', '.oforms-file a.oforms-file-remove', function(evt) {
    evt.preventDefault();
    var fileElement = $(this).parents('.oforms-file').first();
    fileElement.removeClass('oforms-file-in-progress oforms-file-error');
    $('input[type=hidden]', fileElement).val('');
    $('.oforms-file-display', fileElement).text('');
    $('.oforms-file-remove', fileElement).hide();
    $('.oforms-file-prompt', fileElement).show();
});

// -----------------------------------------------------------------------------------------------------------------

// Support for repeating sections with file upload UI at the top
$('.oforms-repeat-file-ui', oform).each(function() {
    var fileUIElement = this;
    window.oFormsFileDelegate.fileRepeatingSectionInitTarget(fileUIElement, function(file) {
        var row = repeatingSectionAddRow(fileUIElement);
        var fileElement = $('.oforms-file input[type=file]', row).parents('.oforms-file').first();
        return fileElementStartUploadUserInteface(fileElement, file);
    });
});

/////////////////////////////// element_support/date.js ///////////////////////////////

var MONTH_NAMES_DISP = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
var MONTH_NAMES_ABBR = ['ja','f','mar','ap','may','jun','jul','au','s','o','n','d'];

var forgivingDateParse = function(str, asComponentArray) {
    var elements = trimWhitespace(str).split(/\W+/);
    if(elements.length != 3) {return;}
    var day = parseInt(elements[0], 10);
    var year = parseInt(elements[2], 10);
    if(!day || !year) {return;}
    var month = parseInt(elements[1], 10);
    if(month === 0 || isNaN(month)) {
        // Attempt text parsing
        for(var i = 0; i < MONTH_NAMES_ABBR.length; ++i) {
            var abbr = MONTH_NAMES_ABBR[i];
            if(elements[1].toLowerCase().substring(0,abbr.length) === abbr) {
                month = i + 1;
                break;
            }
        }
    }
    if(!month) {return;}
    var internalDate = padZeros(year,4)+'-'+padZeros(month,2)+'-'+padZeros(day,2);
    var isValidDate;
    // Attempt check the date is actually valid
    var testYear = 2000+(year % 1000);  // Work within supported range of dates
    try {
        var d = new Date(testYear, month - 1, day);
        if(d && (d.getFullYear() === testYear) && (d.getMonth() === (month - 1)) && (d.getDate() === day)) {
            isValidDate = true;
        }
    } catch(e) {
        // if there's an exception, isValidDate won't be set to true
    }
    return isValidDate ? (asComponentArray ? [year,month,day] : internalDate) : undefined;
};

var validatingDateFieldCopyIntoHidden = function(userInput) {
    var hidden = $('input[type=hidden]', $(userInput).parent());
    var date = forgivingDateParse(userInput.value);
    hidden.val(date || (userInput.value ? 'invalid' : '')); // if blank, hidden element is blank too
    return date;
};

var setDateFieldFromComponents = function(userInput, dateComponents) {
    var hidden = $('input[type=hidden]', $(userInput).parent());
    var yyyy = padZeros(dateComponents[0],4);
    var dd = padZeros(dateComponents[2],2);
    hidden.val(yyyy+'-'+padZeros(dateComponents[1],2)+'-'+dd);
    userInput.value = dd+' '+MONTH_NAMES_DISP[dateComponents[1]]+' '+yyyy;
    userInput.focus();
};

// --------------------------------------------------------------------------------------------------------

// Calendar pop up
var calendarPopup = (function() {
    var popup;
    var currentClickFn;
    var currentMonth;
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    var makePopupContents = function(dateComponents) {
        var d, year, month, day;
        if(dateComponents) {
            year = dateComponents[0]; month = dateComponents[1]; day = dateComponents[2];
        } else {
            d = new Date();
            year = d.getFullYear(); month = d.getMonth()+1; // but not the day, so it's not selected
        }
        // Year and month always set.
        currentMonth = [year, month];
        // Day is set if there's a selected day.
        var yearStr = ''+year;
        while(yearStr.length < 4) { yearStr = '0' + yearStr; }
        var html = [
            '<a href="#" class="oforms-calendar-popup-month-move">&#9668;</a><span class="oforms-calendar-popup-monthyear">',
            monthNames[month - 1], ' ', yearStr,
            '</span><a href="#" class="oforms-calendar-popup-month-move">&#9658;</a>',
            '<span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>'
        ];
        // Generate the days... remember year is a larger range than JS can handle, so use a modulus of it
        d = new Date(2000+(year % 1000), month - 1, 1);
        // Output spans for the unused days
        for(var l = 0; l < d.getDay(); ++l) {
            html.push('<span>&nbsp;</span>');
        }
        // Output links for the used days
        while(d.getMonth() === (month - 1)) {
            var dd = d.getDate();
            if(dd === day) {
                html.push('<span class="oforms-calendar-popup-selected">', dd, '</span>');
            } else {
                html.push('<a href="#" data-date="', year, ' ', month, ' ', dd, '">', dd, '</a>');
            }
            d.setDate(dd+1);    // next day, will wrap to next month
        }
        return html.join('');
    };

    // Public interface
    return {
        _display: function(input, dateComponents, clickFn) {
            if(!popup) {
                // Create popup
                popup = document.createElement('div');
                popup.id = 'oforms-calendar-popup';
                document.body.appendChild(popup);
                $(popup).
                    on('click mousedown', function(evt) { evt.preventDefault(); }).  // stop focus changing on clicks, etc
                    on('mousedown', 'a', function(evt) {
                        var date = this.getAttribute('data-date');
                        if(date) {
                            // One of the date numbers has been clicked
                            var components = _.map(date.split(' '), function(x) { return parseInt(x, 10); });
                            if(currentClickFn) {
                                currentClickFn(components);
                            }
                            popup.innerHTML = makePopupContents(components);
                        } else if(this.className === 'oforms-calendar-popup-month-move') {
                            // Back or forward on the months
                            var dir = (this.previousSibling) ? 1 : -1;  // back is first node in popup
                            var y = currentMonth[0], m = currentMonth[1] + dir;
                            if(m < 1) {
                                m = 12;
                                y--;
                            } else if(m > 12) {
                                m = 1;
                                y++;
                            }
                            popup.innerHTML = makePopupContents([y, m]);
                        }
                    });
            }
            popup.innerHTML = makePopupContents(dateComponents);
            // Position and show
            positionClone(popup, input, input.offsetWidth - 64, -192);
            $(popup).show();
            // Store callback
            currentClickFn = clickFn;
        },
        _blur: function() {
            if(popup) {
                $(popup).hide();
            }
            currentClickFn = undefined;
        }
    };

})();

// --------------------------------------------------------------------------------------------------------

oform.on({
    'keyup': function() { validatingDateFieldCopyIntoHidden(this); },
    'focus': function() {
        var userInput = this;
        // When element get the focus, remove the error marker, as it's distracting
        $(userInput).removeClass('oforms-invalid-date');
        calendarPopup._display(userInput, forgivingDateParse(userInput.value, true), function(dateComponents) {
            setDateFieldFromComponents(userInput, dateComponents);
        });
    },
    'blur': function() {
        // When element loses the focus, display an error marker on the field
        if(validatingDateFieldCopyIntoHidden(this)) {
            $(this).removeClass('oforms-invalid-date');
        } else {
            if(this.value) {
                $(this).addClass('oforms-invalid-date');
            }
        }
        calendarPopup._blur();
    }
}, '.oforms-date-input');

/////////////////////////////// element_support/guidance_note_events.js ///////////////////////////////

// Apply event handlers defined in guidance_note_impl.js
// There's a single guidance note UI for all forms on a page.
oform.on('focus', 'input,textarea,select', guidanceNoteOnFocus);
oform.on('blur', 'input,textarea,select', guidanceNoteOnBlur);

/////////////////////////////// element_support/postamble.js ///////////////////////////////
    });
});

/////////////////////////////// autofocus.js ///////////////////////////////

// When the document loads, set the focus to the first input fields in the form. Do things in a slightly complex manner to
// put the insert point nicely at the end of the field. Internet Explorer, as usual, makes this amusing.
$(document).ready(function() {
    var allInputs = $('input[type=text], textarea', '.oform'); // don't use :first or .first() for performance
    for(var i = 0; i < allInputs.length; ++i) {
        var element = allInputs[i];
        // If the element, or any of it's parents, has the special class, skip it
        var e = $(element);
        if(e.hasClass("oforms-no-autofocus") || (e.parents(".oforms-no-autofocus").length > 0)) {
            continue;
        }
        // If acceptable, focus then finish the loop
        element.focus();
        if(navigator.appVersion.indexOf('MSIE') > 0 && !(window.opera)) {
            element.select();
            var r = document.selection.createRange();
            r.collapse(false);
            r.select();
        } else if(element.setSelectionRange) {
            element.setSelectionRange(element.value.length, element.value.length);
        } else {
            element.value = element.value;
        }
        break;
    }
});

/////////////////////////////// jquery_postamble.js ///////////////////////////////

})(this, jQuery);

