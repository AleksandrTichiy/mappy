/*jslint passfail: true, nomen: true, vars: true, white: true, indent: 2, maxerr: 999 */

/*
 * Developed by : www.toepoke.co.uk
 *
 * If you redistribute this file, please keep this section in place.
 *
 * License: Same as jQuery - see http://jquery.org/license
 *
 * Compressed with:
 *   - http://closure-compiler.appspot.com/
 *
*/

(function () {
	// http://www.yuiblog.com/blog/2010/12/14/strict-mode-is-coming-to-town/
	"use strict";	
	
	// singleton here (same variable across all instances of the plug-in)
	var _version = '(0.1)',
			_plugInName = "mappy",
			_plugInInstances = 1
	;

	$.fn.mappy = function (options) {
		// consts
		// - Somewhere near the City Varieties ...
		var DEFAULT_CENTER = new google.maps.LatLng(53.798823, -1.5426760000000286);
		var DEFAULT_ZOOM = 10;
		
		var BUTTONS = {
			// labels and tooltips for the various buttons (anything after the pipe(|) is the tooltip)
			Go:        "Go",
			More:      "More|There are more results available ...",
			AddPlace:  "+|Add a place",
			CloseMap:  "&times;|Close map",
			Geo:       "&otimes;|Centre map based on your location",
			Help:      "?|Show help"			
		};
		
		// private plug-in variables
		var _plugIn = this,           // Reference back to the "mappy" plug-in instance
				_searchBox = null,        // Search box that appears on the map 
				_gmSearchBox = null,      // Google (autocompleting) Search box the underlying input text box is twinned with 
				_searchBtn = null,        // Button to click to confirm search should be applied (not strictly needed (ENTER does the same), but users may be confused if there isn't one!)
				_moreBtn = null,          // Available when more results are available for a result set (Google Places API pages the results)
				_pageNum = 0,             // Keeps track of how many pages of results are shown (used to reset the markers on a new search)
				_gMap = null,             // Underlying Google maps object for the div
				_mapContainer = null,     // jQuery reference to the DIV the map is in
				_placesApi = null,        // Reference to the Google Places API object
				_markers = [],            // Set of markers displayed on the map
				_instance = -1,           // Instance "this" plug-in is managing (so we can support zmultiple maps on the page)
				_fullWin = false,         // Flags "mappy" is in full-window mode, which means "mappy" created the DIV we're in
				_firstSearch = true,      // Used to ensure we don't clear markers when the map is drawn for the first time (so any "showOnLoad" markers aren't cleared)
				_hasMapInitFired = false, // Used to flag initialisation of the map (after Google Maps API has finished drawing it)
				_areBoundsSet = false,    // Used to flag that an event has set the boundary (so we don't set the zoom/center manually as GM will calc this for us)
				_helpBtn = null,          // Reference to the help dialog button ([?])
				_helpDlg = null,          // Reference to the help dialog that is toggled by the help button
				_closeBtn = null,         // Reference to the close button (only used in full-window mode)
				_addBtn = null,           // Reference to the add button ([+])
				_geoBtn = null,           // Reference to the Geo location button [(*)]
				gm = null,                // Short cut reference to the Google Maps namespace (this is initialised in the constructor to give the Google API time to load on the page)
				gp = null                 // Short cut reference to the Google Places namespace (this is initialised in the constructor to give the Google API time to load on the page)
		;

		/// <summary>
		/// Plug-in options:
		/// Set of options to configure how the map will behave
		/// </summary>
		var settings = $.extend({
			// Array of places to show on the map initially
			// (see accompanying examples for illustration)
			showOnLoad: null,
			
			// Options for drawing the map.  This is the same object
			// that is passed to the Google Maps API when creating the map.
			// If you need something custom supported by the Google Maps API
			// you should be able to add in your own initialisation code 
			// to this object.
			mapOptions: {
				// Initial zoom level (initially not set)
				// ... be cautious when setting a zoom level _and_ defining custom places as you may set the
				// ... level to such a level that your places aren't visible
				zoom: DEFAULT_ZOOM,
				
				// Default to the best theatre ever :-)
				center: DEFAULT_CENTER,

				// Type of map to show initially
				mapTypeId: google.maps.MapTypeId.ROADMAP
			},
			
			// Flags whether Google Maps should still display other points-of-interest
			// By default POI is enabled because the POIs can't be turned off when using custom styled maps
			// (well without significant hacks!)
			// If you require custom maps, you need "disablePoi" set to false
			disablePoi: false,
			
			// Flags that the user can add new places (as well as edit/delete), an "+" icon appears
			// at the top right of the map
			allowAdd: false,
			
			searchOptions: {
				// Flags that the user can search for places themselves
				// ... adds a search box to the map
				enabled: false,
				
				// Placeholder text for the search box
				placeholder: "e.g. Hotels in Leeds",

				// Initialises the place search with a given text search
				// ... (i.e. once the map has been created, the results for this string are also shown)
				initSearch: "Hotels in Leeds"
			},
				
			// Event when user clicks the "Select" button
			// prototype: function(mappy, details)
			onSelect: null,
			
			// Allows new places to be edited
			// prototype: function(mappy, newPlace)
			//   return a error message string if you're not happy with what's been entered
			//   return an empty string to confirm it's been saved
			onSave: null,
			
			// Allows the user to delete a "custom" map they've previously added
			// prototype: function(mappy, details)
			//  return true to confirm delete, false abandons the delete
			onDelete: null,
			
			// Flags that the user is asked for confirmation if they try and
			// delete a place
			confirmDelete: false,

			// Event fires when user clicks the "X" button (only in full window mode)
			// prototype: function(mappy)
			// 	return true to close the map, false keeps it open
			onClose: null,
			
			// Adds a help button to give further instructions to the end user
			// prototype: function()
			getHelpWindow: null,
			
			// show the help dialog when the map is loaded
			showHelpOnLoad: false,
			
			// Adds a GEO location button onto the map which is used to set the 
			// centre of the map according to the user's GEO location position
			allowGeo: false,
			
			// Flags that mappy should place the centre of the map where the user's
			// GEO location position is.
			// Note: This is ignored if "showOnLoad" property is populated as there is 
			//       a risk the places won't be shown on the map
			findGeoOnLoad: false
				
		}, options || {});
		

		//
		// PUBLIC METHODS
		//
		
		/// <summary>
		/// Get the settings the map was build with
		/// </summary>
		this.getSettings = function() {
			return settings;
		};
		
		
		/// <summary>
		/// Gets the underlying Google Map object that was initially
		/// created
		/// - useful if you want to play directly with the map to provide
		///   further functionality outside mappy
		/// </summary>
		this.getGoogleMap = function() {
			return _gMap;
		};
		
		
		/// <summary>
		/// Usually you'll already know this (it's how you called up 
		/// the mappy jQuery plugin - however in full-window mode the div is
		/// generated, so you'll need this then ... sometimes :-) 
		/// - see "onPreInit" full-window example.
		/// </summary>
		this.getMapContainer = function() {
			return _mapContainer;
		};
		
		
		/// <summary>
		/// Helper method to make it a bit easier to add your own controls onto
		/// the map.
		/// markUp - HTML for the control (just HTML, no jQuery or anything, ID is _not_ required)
		/// ctrlPos - Where on the map the control should be added, available options details here:
		///           https://developers.google.com/maps/documentation/javascript/controls#ControlPositioning
		/// </summary>
		this.addMapControl = function(markUp, ctrlPos) {
			var $control = null,
					$html = null
			;
			
			// create a jQuery object out of the markup
			$html = $(markUp);
			
			// add control into the DOM 
			// ... (as part of the map container as the control is "owned" by the map)
			$control = $html.appendTo(_mapContainer);
			
			// tell Google Maps where to place it
			_gMap.controls[ctrlPos].push($control[0]);
			
			// and return the create control so the events can be wired up
			return $control;
		};
		

		/// <summary>
		/// Turns off clicking of Google places of interest.
		/// Note this turns off ALL styling so don't use this option
		/// when using custom styles.
		/// </summary>
		this.disablePointsOfInterest = function() {
			_gMap.styles = 
			[
				{
					featureType: "poi",
					stylers: [
						{ visibility: "off" }
					]
				}
			];
		
		},
		

		/// <summary>
		/// When in full-window mode, this will close the map 
		/// and release resources.
		/// </summary>
		this.closeMap = function() {
			// just kill the DIV container and Google object
			_gMap = null;

			// close help dialog (if displayed)
			if (_helpDlg) {
				_helpDlg.fadeOut();
			}
			
			// close if only available if we created the DIV and we're in full screen mode
			// so kill off the DIV and remove
			_mapContainer.fadeOut(function() {
				$(this).remove();
			});
			
			// no longer in full window mode
			_fullWin = false;

		} // closeMap
		

		/// <summary>
		/// Displays a modal message over the top of the map
		/// title - text to appear in the title bar
		/// msg - text to appear as the main message
		/// callback - callback function to call when OK is clicked
		/// </summary>
		this.showMsg = function(title, msg, callback) {
			buildMsg(title, msg, false/*doConfirm*/, "", callback);
		}
		

		/// <summary>
		/// Displays a modal confirmation over the top of the map, prompting
		/// the user to "confirm" _some_ action
		/// title - text to appear in the title bar
		/// msg - text to appear as the main message
		/// prompt - text to appear next to the action buttons
		/// callback - callback function to call when OK is clicked
		///            Note the callback is ONLY called when OK is clicked
		/// </summary>
		this.confirmMsg = function(title, msg, prompt, callback) {
			buildMsg(title, msg, true/*doConfirm*/, prompt, callback);
		}
		
		
		/// <summary>
		///
		/// </summary>
		this.setMapCentreByGeo = function() {
			if (!navigator.geolocation)
				// GEO location not supported
				return;
				
			navigator.geolocation.getCurrentPosition(
				function(geoPos) {
					var pos = new gm.LatLng(geoPos.coords.latitude, geoPos.coords.longitude);
					
					_gMap.setCenter(pos);
					
					// change geo button to show it's now active
					_geoBtn.addClass("is-active");
				},
				function(err) {
					_plugIn.showMsg("GEO Position", err.message);
				}
			);
		}
		
				
		//
		// MAPPY EVENT HANDLERS
		// - Handlers for mappy events.  Typically these will issue
		// callbacks to the calling application (see events in the settings above)
		//
		
		/// <summary>
		/// Internal event handler when the "Select" button is clicked
		/// - Builds the model and forwards onto the callback for confirmation
		/// </summary>
		function onPlaceSelect(element) {
			var $root = element.parents(".mappy-root");
			var $vw = element.parents(".mappy-view");
			var model = getViewModel($vw);
		
			if (settings.onSelect(_plugIn, model)) {
				closeTooltips();
			}

		} // onPlaceSelect
		
		
		/// <summary>
		/// Internal event handler when the "Edit" button is clicked
		/// - Swaps the tooltip to edit mode, prompting for data entry
		/// </summary>
		function onPlaceEdit(element) {
			var $root = element.parents(".mappy-root");
			var lat = $root.find(".mappy-lat").val();
			var lng = $root.find(".mappy-lng").val();
			
			// find the appropriate marker
			var marker = findMarker(lat, lng);
			
			// close any open tooltips so the user can concentrate on editing
			closeTooltips();
			
			// user clicks the edit button, so swap to edit mode
			marker.showTooltip(true/*inRwMode*/);
		
		} // onPlaceEdit
		

		/// <summary>
		/// Internal event handler when the "Delete" button is clicked
		/// - Builds the model and forwards onto the callback for confirmation.
		/// </summary>
		function onPlaceDelete(element) {
			var $root = element.parents(".mappy-root");
			var $vw = $root.find(".mappy-view");
			var model = getViewModel($vw);
			
			if (settings.onDelete(_plugIn, model)) {
				// find the appropriate marker
				var marker = findMarker(model.lat, model.lng);

				// remove the marker
				marker.setMap(null);
				marker.tooltip = null;
			}
			
		} // onPlaceDelete

		
		/// <summary>
		/// Internal event handler when the "Save" button is clicked (in the edit dialog)
		/// - Builds the model and forwards onto the callback for confirmation and validation
		/// - Should the validation fail (callback returns error messages) the edit dialog
		///   will remain for the user to resolve the errors
		/// </summary>
		function onPlaceSave(element) {
			var root = element.parents(".mappy-root");
			var $rw = root.find(".mappy-edit");
			var errors = "";
			var place = getViewModel($rw);
			
			// see if the calling code is happy with what's being changed
			errors = settings.onSave(_plugIn, place);
			
			var errCtx = $rw.find(".mappy-error");
			if (errors && errors.length > 0) {
				// not happy, show errors returned
				errCtx.text(errors);
				return;
			}
			// no errors
			errCtx.text("");

			// find the marker, so we can update the model on the marker
			var marker = findMarker(place.lat, place.lng);
			
			// update the model to reflect the changes made
			jQuery.extend(marker.details, place);
			
			// once an object has been edited successfully it becomes a normal editable "custom" object
			root.find(".mappy-marker-type").val("custom");
			// also need to save back the userData (which may have changed, but is outside the view)
			root.find(".mappy-user-data").val(place.userData);
			
			// editing complete, go back to the "Select" mode
			marker.showTooltip(false/*inRwMode*/);
			
		} // onPlaceSave

		
		//
		// GOOGLE EVENT HANDLERS
		// - Set of Google events consumed by the plug-in
		//
		
		/// <summary>
		/// Fires once the map has initially loaded.  This lets us do some initialisation
		/// for the map (e.g. change positions of buttons we've added to the map as these are
		/// set by Google Maps so we have to wait until the map is loaded before we tweak them).
		/// </summary>
		function gmMapLoaded() {
		
			if (_helpDlg) {
				// note _helpBtn is the container, not the link inside the container
				var btnContainer = _helpBtn;
				
				// work out where the top-left of the dialog should be placed
				var dialogLeft = btnContainer.position().left;
				dialogLeft += (btnContainer.width() / 2);
				dialogLeft -= (_helpDlg.width() / 2);
				
				var dialogTop = btnContainer.position().top;
				dialogTop += btnContainer.height() * 2;
				
				_helpDlg
					.css("z-index", 999)
					.css("position", "absolute")
					.css("top", dialogTop)
					.css("right", "1%")
					.css("width", "20%")
				;
				
				if (settings.showHelpOnLoad && _helpBtn.click) {
					_helpBtn.trigger("click");
				}
			}

			// if Geo location is enabled, find the location
			// ... note we don't use Geo on load if there are custom places to
			// ... show - otherwise there's a [high] risk we won't see the places
			// ... because they're looking somewhere else
			if (settings.findGeoOnLoad && !settings.showOnLoad) {
				_plugIn.setMapCentreByGeo();
			}
			
		} // gmMapLoaded


		/// <summary>
		/// Event hookup for when a place is selected by the end user from the search
		/// control (if enabled).
		/// places: Results from the Google Places API query
		/// </summary>
		function gmPlaceSelected(places, status, pagination) {
			if (!_firstSearch) {
				// If we're pre-populated the map with markers (via "showOnLoad" setting)
				// and put some results up on start-up (via the "initSearch" option)
				// we don't want to clear the markers as we'll remove the "showOnLoad"
				// ones we've added
				
				if (_pageNum == 0)
					clearMarkers(); 
			}
			_firstSearch = false;
			
			if (status == "ZERO_RESULTS") {
				// nothing to see here
				_plugIn.showMsg("No results", "Your search returned no results.");
			}
			
			// For each place, get the icon, place name, and location.
			var bounds = new gm.LatLngBounds();
			for (var i = 0, place; place = places[i]; i++) {
				if (!place.reference)
					continue;

				var pos = place.geometry.location;
				var marker = addMarker(place, pos, "google", bounds);

				// start off with just the minimal info we're given
				// ... later we'll try and get more details, but if we can't at least
				// ... we have _something_!
				normaliseFormattedAddress(marker.details, place.formatted_address);
				
				// expand the map out so the new places fit
				bounds.extend(pos);
				_gMap.fitBounds(bounds);
			} // for
			
			if (pagination) {
				_moreBtn[0].disabled = !pagination.hasNextPage;
				
				if (pagination.hasNextPage) {
					gm.event.addDomListenerOnce(_moreBtn[0], "click", function() {
						event.preventDefault();
						
						_pageNum++;
						pagination.nextPage();
					});
				}
			}

		} // gmPlaceSelected
		
		
		/// <summary>
		/// Helper method to perform a search to the Google Places API, translate
		/// the results into something more useful for us and fire a callback once complete
		/// </summary>
		function getPlaceDetails(forMarker, callback) {
			if (!forMarker.details)
				return;
			if (!forMarker.details.reference)
				return;

				
			var request = {
				reference: forMarker.details.reference
			};
			_placesApi.getDetails(request, 
				function(placeDetails, status) {
					// Either way we're loaded. 
					// If we fail, we revert to using the basic data (otherwise we'll just keep trying!)
					forMarker.details.isLoaded = true;
				
					if (status != gp.PlacesServiceStatus.OK) {
						return;
					}
					
					normalisePlacesApiAddress(forMarker.details, placeDetails);				

					callback(forMarker);
				}
			);
			
		} // getPlaceDetails
		
		
		/// <summary>
		/// Map boundary change event (moving map, zooming in or out, etc).
		/// - Required so we can tell the search box (if enabled) that the 
		///   boundary of the map (and therefore the boundary the search should
		///   be applied to) has changed.
		/// </summary>
		function gmBoundsChanged() {
			var bounds = _gMap.getBounds();
			if (bounds) {
				_gmSearchBox.setBounds(bounds);
			}
			
			// Boundary has been set, so don't set the zoom/center
			_areBoundsSet = true;
		} // gmBoundsChanged

		
		//
		//
		// PRIVATE METHODS
		//
		//		

		/// <summary>
		/// Helper for building up a modal message on the screen.
		/// title - text for the title bar
		/// msg - message text to appear
		/// doConfirm - internal flag tell us whether we're building an "alert" or a "confirm"
		/// prompt - text to appear next to the action buttons
		/// callback - callback for when Yes/OK is clicked.  
		///            Note the callback is _NOT_ called if "cancel" is pressed.
		/// </summary>
		function buildMsg(title, msg, doConfirm, prompt, callback) {
			var $modal = null,
					html = "",
					buttons = ""
			;
			
			// protect from undefined
			title = title || "";
			msg = msg || "";
			
			$modal = _mapContainer.find(".mappy-modal");
			
			if ($modal.length > 0) {
				// usually we'd just re-use it, but we need to change basically 
				// everything (include the callback)
				$modal.remove();
			}

			buttons += "<div class='mappy-modal-button-bar'>";
				if (prompt && prompt.length > 0) {
					buttons += "<p class='prompt'>" + prompt + "</p>";
				}
				buttons += "<div class='mappy-modal-buttons'>";
				if (doConfirm) {
					buttons += "<button class='ok'>OK</button>";
					buttons += "<button class='cancel'>Cancel</button>";
				} else {
					buttons += "<button class='close'>OK</button>";
				}
				buttons += "</div>";
			buttons += "</div>";
			
			html = 
				"<div class='mappy-modal'>" + 
					"<h3>" + title + "</h3>" + 
					"<div>" +
						"<div class='mappy-modal-message'>" + 
							msg + 
						"</div>" +
						buttons +
					"</div>" + 
				"</div>"
			;
			
			$modal = $(html).appendTo(_mapContainer);
			$modal
				.find("button")
					.on("click", function() { 
						var $btn = $(this);
						$modal.fadeOut(); 
						if (!$btn.hasClass("cancel")) {
							// only call the callback if we haven't cancelled
							if (callback)
								callback($btn);
						}
					})
					.end()
				.fadeIn()
			;

		} // showMsg

		
		/// <summary>
		/// Convenience function to add a new marker onto a map
		/// and wire up the events (click, etc).
		/// </summary>
		function addMarker(model, position, markerType, inBoundary) {
			var marker = createMarker(
				model.name,
				position,
				false/*draggable*/,
				markerType
			);
			
			jQuery.extend(marker.details, model);
			attachTooltip(marker);
			_markers.push(marker);
			inBoundary.extend(position);
			
			// wire up click event
			gm.event.addListener(marker, "click", function() {
				var m = this;
				closeTooltips();
				m.showTooltip(false/*inRwMode*/);
			});
			if (model.autoShow) {
				// show on load enabled for marker
				marker.showTooltip(false/*inRwMode*/);
			}
			
			_areBoundsSet = true;
			
			return marker;
			
		} // addMarker
		
		
		/// <summary>
		/// Convenience function to shorten a string to a 
		/// maximum length, adding an ellipsis (...) if required.
		/// </summary>
		function shorten(value, maxLen) {
			var shortValue = value;
			
			if (!maxLen) {
				maxLen = 30;
			}
			
			if (value.length > maxLen) {
				shortValue = value.substring(0, maxLen-3) + "...";
			}

			return shortValue;
		
		} // shorten
		
		
		/// <summary>
		/// Quick and dirty replace method for applying templates
		/// </summary>
		var replaceAll = function(find, replace, str) {
			if (replace == undefined)
				replace = "";
			return str.replace(new RegExp(find, 'g'), replace);
		
		} // replaceAll
		

		/// <summary>
		/// Quick and dirty template function, just does a replacement
		/// according to our model ... nothing more advanced than that!
		/// </summary>
		function applyTemplate(tmpl, model, $ctx) {
			tmpl = replaceAll("{NAME}", model.name, tmpl);
			tmpl = replaceAll("{SHORT_NAME}", shorten(model.name, 25), tmpl);
			tmpl = replaceAll("{STREET}", model.street, tmpl);
			tmpl = replaceAll("{TOWN}", model.town, tmpl);
			tmpl = replaceAll("{AREA}", model.area, tmpl);
			tmpl = replaceAll("{POSTCODE}", model.postCode, tmpl);
			tmpl = replaceAll("{TELNO}", model.telNo, tmpl);
			tmpl = replaceAll("{WEBSITE}", model.website, tmpl);
			tmpl = replaceAll("{GPLUS}", model.url, tmpl);
			if (model.photo) {
				var path = model.photo.getUrl({"maxWidth": "70"});
				tmpl = replaceAll("{PHOTOURL}", path, tmpl);
				// used to delay when jQuery tries to render the image tag
				tmpl = replaceAll("{IMG", "<img", tmpl);
			}
			
			$ctx.html(tmpl);
			
		} // applyTemplate


		/// <summary>
		/// Ensures when the view is shown any entities with nothing in them aren't 
		/// shown (and any that are shown, are shown correctly)
		/// </summary>
		function hideEmpty(model, $vw) {
			// and hide bits that aren't relevant (or empty)
			$vw.find(".mappy-name").parent().toggle( model.name && model.name.length > 0 );
			$vw.find(".mappy-street").toggle( model.street && model.street.length > 0 );
			$vw.find(".mappy-town").toggle( model.town && model.town.length > 0 );
			$vw.find(".mappy-area").toggle( model.area && model.area.length > 0 );
			$vw.find(".mappy-postCode").toggle( model.postCode && model.postCode.length > 0 );

			// these are a little different as we want them block if they're available (they're a tags)
			var $telNo = $vw.find(".mappy-telNo"),
					$ws = $vw.find(".mappy-website"),
					$url =  $vw.find(".mappy-url")
			;
			if (model.telNo && model.telNo.length > 0) {
				$telNo.show().css("display", "block");
			} else {
				$telNo.hide();
			}
			if (model.website && model.website.length > 0) {
				$ws.show().css("display", "block");
			} else {
				$ws.hide();
			}
			if (model.url && model.url.length > 0) {
				$url.show().css("display", "block");
			} else {
				$url.hide();
			}
			
			$vw.find(".mappy-right").toggle( model.photo != null );
			
			var settings = _plugIn.getSettings();

			if (settings.onSelect || settings.onSave || settings.onDelete) {
				var showSelect,showSave,showDelete,canEdit;

				canEdit = model.canEdit;
				// however if it's a google marker we can't, so ignore what the input says!
				if (model.markerType == "google")
					canEdit = false;
				
				showSelect = settings.onSelect != null;
				showSave = (settings.onSave != null && canEdit);
				showDelete = (
							settings.onDelete != null && canEdit 
							// can only delete markers we created!
							&& model.markerType == "custom"
						)
				;
				
				$vw.find(".mappy-select-button").toggle( showSelect );
				$vw.find(".mappy-edit-button").toggle( showSave );
				$vw.find(".mappy-delete-button").toggle( showDelete );
			} else {
				// neither should be shown, so hide the button container to hide the whole row
				$vw.find(".mappy-buttons").hide();
			}
		
		} // hideEmpty
		
		
		/// <summary>
		/// Finds a marker in the loaded set based on the provided lat/lng 
		/// co-ordinates
		/// - the model doesn't have a reference to the markers, hence the need to find them
		/// </summary>
		function findMarker(lat, lng) {
			var marker = null;
			
			for (var i=0; i < _markers.length; i++) {
				var m = _markers[i];
				if (m.position.lat() == lat && m.position.lng() == lng) {
					marker = m;
					break;
				}
			}
			
			return marker;
		
		} // findMarker

		
		/// <summary>
		/// Adds a search box to the top left of the map which the user can use
		/// to search for places of interest.
		///
		/// Google Maps API:
		/// 	https://developers.google.com/maps/documentation/javascript/examples/places-searchbox
		/// </summary>
		function addSearch() {
			var id = "mappy-search-box-" + _instance;
			
			_searchBox = $("#" + id);
			if (_searchBox.length > 0)
				// already added
				return;

			// create the "search" box and add to document (in body)
			var so = settings.searchOptions,
					html = "<input type='text' id='" + id + "' class='mappy-searchbox' autocomplete='off' "
			;
			html += "placeholder='";
			if (so.enabled && so.placeholder)
				html += so.placeholder;
			else 
				html += "Search ...";
			html += "' ";
			if (so.enabled && so.initSearch && so.initSearch.length > 0)
				html += " value='" + so.initSearch + "'";
			html += " />";
			
			_searchBox = $(html).appendTo(_mapContainer);
		
			// associate with places api
			// ... note Google Maps API doesn't play well with jQuery
			_gmSearchBox = new gp.SearchBox(_searchBox[0]);
			// Place search box onto the screen
			_gMap.controls[gm.ControlPosition.TOP_LEFT].push(_searchBox[0]);
			
			// and wire up the callback when a user selects a hit
			gm.event.addListener(_gmSearchBox, "places_changed", 
				function() {
					var searchFor = _searchBox.val();
					doSearch(searchFor);
				}
			);
			// and again for when they zoom in/out
			gm.event.addListener(_gMap, "bounds_changed", gmBoundsChanged);
			
			_searchBtn = createControlButton(
				BUTTONS.Go, gm.ControlPosition.TOP_LEFT, 
				"mappy-search-button mappy-control-button", 
				function(evt) {
					evt.preventDefault();
					var searchFor = _searchBox.val();
					doSearch(searchFor);
				}
			);
			
			// For handling additional results, note there is not event handlers as this is]
			// ... driven from the first set of search results we get back from Google
			_moreBtn = createControlButton(
				BUTTONS.More, 
				gm.ControlPosition.TOP_LEFT, 
				"mappy-more-button mappy-control-button", 
				null
			);
			// Should be disabled to start with
			_moreBtn[0].disabled = true;
		} // addSearch
		
		
		/// <summary>
		/// Adds a "+" icon to the top right of the map, allowing new places to 
		/// added to the map
		/// </summary>
		function addNewPlaceButton() {
			if (_addBtn)
				// already done
				return;
				
			var onAddEvent = function(evt) {
				evt.preventDefault();
				
				var centre = _gMap.getCenter();
				var bounds = new gm.LatLngBounds();
				var newMarker = createMarker("New place", centre, true/*draggable*/, "new");
				attachTooltip(newMarker);
				
				_markers.push(newMarker);
				bounds.extend(centre);
				
				gm.event.addListener(newMarker, "click", function() {
					var currMarker = this;
					closeTooltips();
					// new places can always be edited
					currMarker.showTooltip(true/*inRwMode*/);
				});
				gm.event.addListener(newMarker, "dragend", function(evt) {
					var currMarker = this;
					// only time when lat/lng can change!
					currMarker.details.lat = evt.latLng.lat();
					currMarker.details.lng = evt.latLng.lng();
					var tip = $(currMarker.tooltip.content);
					tip.find(".mappy-lat").val( currMarker.details.lat );
					tip.find(".mappy-lng").val( currMarker.details.lng );
				});
				// for tooltip to be displayed
				gm.event.trigger(newMarker, "click");
			
			}; // onAddEvent
			
			_addBtn = createControlButton(
				BUTTONS.AddPlace, 
				gm.ControlPosition.TOP_RIGHT, 
				"mappy-add-button mappy-control-button", 
				onAddEvent
			);
			
			
		} // addNewPlaceButton
		
		
		/// <summary>
		/// When in full window mode we need a close button so users can exit
		/// the map (without having to select a place).
		/// </summary>
		function addCloseButton() {
			if (_closeBtn)
				// already done
				return;
				
			var onCloseEvent = function(evt) {
					evt.preventDefault();
					
					if (!_fullWin)
						// already closed
						return;

					var closeMap = true;
					if (settings.onClose) {
						closeMap = settings.onClose(_plugIn);
					}
					// Only close maps mappy created
					// ... if caller created the DIV, it's up to them to destroy
					// ... (they may want to hide rather than kill)
					if (closeMap && _fullWin) {
						_plugIn.closeMap();
					}
					// else 
					// nothing to do, leave map in place as it was					
			};
				
			_closeBtn = createControlButton(
				BUTTONS.CloseMap, 
				gm.ControlPosition.TOP_RIGHT, 
				"mappy-close-button mappy-control-button", 
				onCloseEvent
			);
			// With lightbox type functionality, it's traditional to let the ESCape key close it too
			$("body").on("keyup", function(evt) {
				evt.preventDefault();
				if (evt.which == 27/*ESCape*/)
					onCloseEvent(evt);
			});
			
		} // addCloseButton
		
		
		/// <summary>
		/// 
		/// </summary>
		function addGeoLocationButton() {
			if (_geoBtn)
				// already added
				return;
				
			var onClickEvent = function(evt) {
				_plugIn.setMapCentreByGeo();
			};
			
			_geoBtn = createControlButton(
				BUTTONS.Geo, 
				gm.ControlPosition.TOP_LEFT,
				"mappy-geo-button",
				onClickEvent
			);
			
		} // addGeoLocationButton
		
		
		/// <summary>
		/// Places a help (?) icon at the top right of the map, allowing
		/// instructions to be added to the end user of the map
		/// </summary>
		function addHelpButton() {
			if (_helpDlg)
				// already done
				return;
			
			_helpBtn = createControlButton(
				BUTTONS.Help, 
				gm.ControlPosition.TOP_RIGHT, 
				"mappy-help-button mappy-control-button", 
				function(evt) {
					evt.preventDefault();
					
					// show/hide the dialog
					_helpDlg.fadeToggle();
					_helpBtn.toggleClass("open");
				}
			);

			var helpHtml = settings.getHelpWindow();
			_helpDlg = $(helpHtml).appendTo(_mapContainer);
			_helpDlg.fadeOut();
			
		} // addHelpButton


		/// <summary>
		/// Convenience function for creating control buttons on the map (re-uses
		/// the public "addMapControl" method.  This is just a short-cut for buttons
		/// buttonText: Text to appear in the button
		///             You can also add a tooltip by prefixing it with a pipe, e.g. "Go|Perform a search" will give
		///             a tooltip of "Perform a search"
		/// ctrlPos: Where on the map the control should be added (TOP_LEFT, TOP_RIGHT, etc)
		///          For options, see https://developers.google.com/maps/documentation/javascript/controls#ControlPositioning
		/// addClass: Additional classes to add to the button (to target CSS)
		/// onClickEvent: Callback to execute when the button is clicked
		/// </summary>
		function createControlButton(buttonText, ctrlPos, addClass, onClickEvent) {
			var btn = null,
					markUp = "",
					classes = "",
					tooltip = ""
			;
			
			if (addClass && addClass.length > 0) {
				classes = " class='" + addClass + "' ";
			}
			
			// see if there's a tooltip added
			if (buttonText && buttonText.length > 0) {
				var arrSplit = buttonText.split("|");
				buttonText = arrSplit[0];
				tooltip = (arrSplit.length > 1 ? " title='"+arrSplit[1]+"'" : "");
			}

			var markUp = 
				"<button " 
				+ classes
				+ tooltip
				+ ">" 
				+ buttonText
				+ "</button>"
			;
			
			btn = _plugIn.addMapControl(markUp, ctrlPos);
			
			// and wire up the onclick event handler
			if (onClickEvent) {
				// wire up the click event handler
				btn.on("click", onClickEvent);
			}
			
			return btn;

		} // createControlButton
		
		
		/// <summary>
		/// When the user submits a search (see "searchOptions")
		/// we clear any existing hits otherwise it will get confusing really
		/// quickly.
		/// (plus this is the same behaviour as Google Maps itself)
		/// </summary>
		function clearMarkers() {
			if (_markers && _markers.length > 0) {
				for (var i = 0; i < _markers.length; i++) {
					var currMarker = _markers[i];
					currMarker.tooltip = null;
					currMarker.setMap(null);
				}
			}
			
			_markers = [];
			
		} // clearMarkers
		

		/// <summary>
		/// Closes all marker tooltips that are on-screen.
		/// </summary>
		function closeTooltips() {
			if (_markers && _markers.length > 0) {
				for (var i = 0; i < _markers.length; i++) {
					var current = _markers[i];
					if (current.tooltip)
						current.tooltip.close();
				}
			}
			
		} // closeTooltips
		
		
		/// <summary>
		/// Helper method to create a new marker.
		/// title (string): Tooltip when hovering over the marker on the map (before the dialog tooltip is displayed)
		/// latLon (Google LatLng object): Detailing where the marker should be placed
		/// isDraggable (bool): Flags the marker should be draggable (only used when adding new custom markers)
		/// type (string): Internal flag for the plug-in, can be:
		///   new - Marker is for a new "custom" place that is not yet know about
		///   google - Marker is derived from Google Places API (result from a Places search)
		///   custom - Marker is one specified by the calling application.
		///            Note: A marker can start as "new", but once the application is told about it
		///            it becomes "custom" - notion being the application has saved it to their DB.
		/// </summary>
		function createMarker(title, latLng, isDraggable, type) {
			var image = null;
			
			if (settings.getMarkerImage) {
				image = settings.getMarkerImage(_plugIn, type);
			}
			
			var marker = new gm.Marker({
				map: _gMap,
				icon: image,
				title: title,
				animation: gm.Animation.DROP,
				position: latLng,
				markerType: type,
				draggable: isDraggable
			});
			
			// create a default details object too
			marker.details = {
				markerType: type,
				// isLoaded basically means the extended place data has been loaded
				// ... this is only relevant to places that have come from google, not 
				// ... "custom" or "new" ones
				isLoaded: (type != "google"),
				lat: latLng.lat(),
				lng: latLng.lng(),
				userData: "",
				reference: "",
				name: "",
				street: "",
				town: "",
				area: "",
				postCode: "",
				telNo: "",
				website: "",
				url: "",
				canEdit: (type == "new" || type == "custom")
			};
			
			return marker;
			
		} // createMarker
		
		
		/// <summary>
		/// Builds up the content for an InfoWindow object, which builds up the 
		/// read-only and read-write view templates ready for when the tooltip 
		/// is shown.
		/// </summary>
		function attachTooltip(forMarker) {
			if (forMarker.id) {
				// already created, so return
				var item = $("#mappy-" + forMarker.id);
				return item;
			}
			
			// not yet created, so add to body
			var newId = _markers.length + 1;
			var d = forMarker.details;
			forMarker.id = newId;
			
			var item = $(
				"<div id='mappy-" + newId + "' class='mappy-root'>" + 
					"<input type='hidden' class='mappy-lat' value='" + forMarker.position.lat() + "' />" + 
					"<input type='hidden' class='mappy-lng' value='" + forMarker.position.lng() + "' />" + 
					"<input type='hidden' class='mappy-can-edit' value='" + d.canEdit + "' />" + 
					"<input type='hidden' class='mappy-reference' value='" + d.reference + "' />" + 
					"<input type='hidden' class='mappy-user-data' value='" + d.userData + "' />" + 
					"<input type='hidden' class='mappy-marker-type' value='" + forMarker.markerType + "' />" +
					getViewTemplate() + 
					getEditTemplate() + 
				"</div>"
			);
			
			forMarker.tooltip = new gm.InfoWindow();
			forMarker.tooltip.setContent( item[0] );
			// we'll still need a reference to the marker later on
			forMarker.tooltip.marker = forMarker;
			forMarker.showTooltip = showTooltip;
			
			return item;
			
		} // createTooltip
				
		
		/// <summary>
		/// Handles the showing of the appropriate tooltip, depending 
		/// on whether we're in "edit" or "read" mode.
		/// Also attempts to get more detailed place information from the 
		/// Google Places API if it can (only done once per tooltip).
		/// </summary>
		function showTooltip(inRwMode) {
			var marker = this;
			var tip = marker.tooltip;
			var model = marker.details;
			var $ele = $(tip.getContent());
			var $ro = $ele.find(".mappy-view");
			var $rw = $ele.find(".mappy-edit");
			var settings = _plugIn.getSettings();
	
			// If we're previously got the place details, or it's a "custom" place
			// we're ok, otherwise we'll have to shoot off and get the main details
			if (!model.isLoaded) {
				// don't have full details yet, so go get them
				getPlaceDetails(marker, 
					function(forM) { 
						marker.showTooltip(inRwMode); 
					}
				);
				
				// terminate here, we'll pick up where we left off once we have the details
				return;
			}
			
			// continue displaying the tooltip
			$rw.toggle(inRwMode);
			$ro.toggle(!inRwMode);

			// ensure we have a _clean_ model to play with
			sanitise(model);
				
			if (inRwMode) {
				// re-apply template
				var tmpl = getEditTemplate();
				applyTemplate(tmpl, model, $rw);
				
			} else {
				// re-apply template
				var tmpl = getViewTemplate();
				applyTemplate(tmpl, model, $ro);
				hideEmpty(model, $ro);					
			}
			
			tip.close();
			// re-open for the right width to be used
			tip.open(_gMap, marker);
		
		} // showTooltip
				

		/// <summary>
		/// Template for the read-only view.
		/// </summary>
		function getViewTemplate() {
			// tables!, yes I know, I know.  In my defence "proper" CSS 
			// proved to be too unreliable when used with map tooltips!
			var html = 
			    "<table class='mappy-container mappy-view'>"
			  +	  "<tr><td colspan='2'>"
			  +     "<h1 class='mappy-name' title='{NAME}'>{SHORT_NAME}</h1>"
			  +   "</td></tr>"
			  +   "<tr>"
			  +     "<td class='mappy-left'>"
			  +       "<address>"
			  +         "<div class='mappy-street'>{STREET}</div>"
			  +         "<div class='mappy-town'>{TOWN}</div>"
			  +         "<div class='mappy-area'>{AREA}</div>"
			  +         "<div class='mappy-postCode'>{POSTCODE}</div>"
			  +       "</address>"
			  +       "<a class='mappy-telNo' href='tel:{TELNO}'>{TELNO}</a>"
			  +       "<a class='mappy-website' href='{WEBSITE}' title='{WEBSITE}'>website</a>"
			  +       "<a class='mappy-url' href='{GPLUS}' title='{GPLUS}'>g+</a>"
			  +     "</td>"
			  +     "<td class='mappy-right'>"
			  +       "<a href='{GPLUS}'>{IMG src='{PHOTOURL}' /></a>"
			  +     "</td>"
			  +   "</tr>"
			  +   "<tr class='mappy-buttons'>"
			  +     "<td colspan='2'>"
			  +       "<button class='mappy-select-button'>Select</button>"
			  +       "<button class='mappy-edit-button'>Edit</button>"
			  +       "<button class='mappy-delete-button'>Delete</button>"
			  +     "</td>"
			  +   "</tr>"
			  + "</table>"
			;
			
			return html;
			
		} // getViewTemplate
		
		
		/// <summary>
		/// Template for the read-write view.
		/// </summary>
		function getEditTemplate() {
			var html = 
				 "<div class='mappy-container mappy-address-entry mappy-edit'>"
				+  "<h1>Place details:</h1>"
				+  "<ul>"
				+    "<li>"
				+      "<label>Name"
				+        "<input class='mappy-name' type='text' placeholder='e.g. Bob sandwich shop' value='{NAME}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>Street"
				+        "<input class='mappy-street' type='text' placeholder='e.g. 3 Hemington place' value='{STREET}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>Town"
				+        "<input class='mappy-town' type='text' placeholder='e.g. Leeds' value='{TOWN}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>Area"
				+        "<input class='mappy-area' type='text' placeholder='e.g. West Yorkshire' value='{AREA}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>Postcode"
				+        "<input class='mappy-postCode' type='text' value='{POSTCODE}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>Tel No"
				+        "<input class='mappy-telNo' type='telephone' placeholder='contact telephone number' value='{TELNO}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>website"
				+        "<input class='mappy-website' type='url' placeholder='e.g. https://toepoke.co.uk' value='{WEBSITE}' />"
				+      "</label>"
				+    "</li>"
				+    "<li>"
				+      "<label>g+ url"
				+        "<input class='mappy-url' type='url' placeholder='e.g. https://plus.google.com/+ToepokeCoUk‎' value='{GPLUS}' />"
				+      "</label>"
				+    "</li>"
				+  "</ul>"
				+  "<div class='mappy-buttons'>"
				+    "<button class='mappy-save-button'>Save</button>"
				     // placeholder for error messages
				+    "<span class='mappy-error'>&nbsp;</span>"
				+  "</div>"
				+"</div>"  // mappy-address-entry
			;	

			return html;

			} // getEditTemplate
		
		
		/// <summary>
		/// Creates a model from the view.  The "view" can be the 
		/// read-only select view, or the read-write editor view, the method
		/// works out which is appropriate
		/// </summary>
		function getViewModel($vw) {
			var $root = $vw.parents(".mappy-root");
			var model = {
				canEdit: ($root.find(".mappy-can-edit").val() === "true"),
				lat: $root.find(".mappy-lat").val(),
				lng: $root.find(".mappy-lng").val(),
				reference: $root.find(".mappy-reference").val(),
				markerType: $root.find(".mappy-marker-type").val(),
				userData: $root.find(".mappy-user-data").val()
			};
			
			if ($vw.hasClass("mappy-view")) {
				// select view
				// for "name" => title has full length version
				model.name     = $vw.find(".mappy-name").attr("title");	
				model.street   = $vw.find(".mappy-street").html();
				model.town     = $vw.find(".mappy-town").html();
				model.area     = $vw.find(".mappy-area").html();
				model.postCode = $vw.find(".mappy-postCode").html();
				model.telNo    = $vw.find(".mappy-telNo").html();
				model.website  = $vw.find(".mappy-website").attr("href");
				model.url      = $vw.find(".mappy-url").attr("href");
			
			} else {
				// editor view
				model.name     = $vw.find(".mappy-name").val();
				model.street   = $vw.find(".mappy-street").val();
				model.town     = $vw.find(".mappy-town").val();
				model.area     = $vw.find(".mappy-area").val();
				model.postCode = $vw.find(".mappy-postCode").val();
				model.telNo    = $vw.find(".mappy-telNo").val();
				model.website  = $vw.find(".mappy-website").val();
				model.url      = $vw.find(".mappy-url").val();
			}
			// make sure we aren't returning "undefined" somewhere 
			// ... which can happen if we're in a view that doesn't have a telNo for instance
			sanitise(model);
			
			return model;
			
		} // getViewModel

		
		// some of these might not be there (e.g. showOnLoad not passing a telephone number through)
		// ... so make sure the data we return is sensible
		function sanitise(place) {
			if (!place.canEdit) place.canEdit = false;
			if (!place.lat) place.lat = 0;
			if (!place.lng) place.lng = 0;
			if (!place.userData) place.userData = "";
			if (!place.name) place.name = "";
			if (!place.street) place.street = "";
			if (!place.town) place.town = "";
			if (!place.area) place.area = "";
			if (!place.postCode) place.postCode = "";
			if (!place.telNo) place.telNo = "";
			if (!place.website) place.website = "";
			if (!place.url) place.url = "";
		
		} // sanitise

		
		/// <summary>
		/// Draws any custom places on the map when the map is first drawn.
		/// - see "settings.showOnLoad"
		/// </summary>
		function addInitialPlaces() {
			var placeDetails = [],
					bounds = new gm.LatLngBounds()
			;
			
			clearMarkers();
			
			// "showOnLoad" can be specified as an array or a single object, so if it's the
			// latter, we'll use the former
			var places = [];
			
			if ($.isArray(settings.showOnLoad))
				places = settings.showOnLoad;
			else 
				places.push(settings.showOnLoad);
			
			for (var i=0; i < places.length; i++) {
				var p = places[i],
						pos = new gm.LatLng(p.lat, p.lng),
						markerType = ""
				;
				
				if (p.reference && p.reference.length > 0) {
					// we'll get the details from Google
					markerType = "google";
				} else {
					// coming from our own DB
					markerType = "custom";
				}
				
				addMarker(p, pos, markerType, bounds);				
			}
				
			// we done?
			_gMap.fitBounds(bounds);
			
		} // addInitialPlaces

		
		/// <summary>
		/// Performs a search on the map for the given search string, drawing
		/// the results on the map
		/// </summary>
		function doSearch(searchFor) {
			var boundary = _gMap.getBounds();
			
			// reset the result page count (as we're starting afresh with a new search)
			_pageNum = 0;
			
			var request = {
				query: searchFor,
				// limit to search to boundary of the map screen
				bounds: boundary
			};
			_placesApi.textSearch(request, gmPlaceSelected);
		
		} // doSearch
				
		
		/// <summary>
		/// The "address_components" object provided by the API is quite, erm
		/// "extensive".  This cuts it down into something a little more
		/// usable for our purposes.
		/// details: object to be normalised (this is a Google Places result)
		/// </summary>
		function normalisePlacesApiAddress(details, fromGP) {
			var ac = fromGP.address_components;
			 
			// Copy Googles version of an address to something more useable for us
			var street = findPart(ac, "street_address");
			if (street === "")
				// not present so fallback to "route"
				street = findPart(ac, "route");
			
			var town = findPart(ac, "locality"),
					area = findPart(ac, "administrative_area_level_1"),
					postCode = findPart(ac, "postal_code")
			;
			
			details.street = street;
			details.town = town;
			details.area = area;
			details.postCode = postCode;
			
			// and some other bits
			details.name = fromGP.name || "";
			if (fromGP.photos && fromGP.photos.length > 0)
				details.photo = fromGP.photos[0];
			details.url = fromGP.url || "";
			details.website = fromGP.website || "";		
			details.telNo = fromGP.formatted_phone_number || fromGP.telNo || "";
		
		} // normalisePlacesApiAddress
		
		function normaliseFormattedAddress(details, src) {
			if (!src)
				return;
			var elements = src.split(",");
			
			// pure guess!
			if (elements.length >= 1)
				details.street = $.trim(elements[0]);
			if (elements.length >= 2)
				details.town = $.trim(elements[1]);
			if (elements.length >= 3)
				details.area = $.trim(elements[2]);
			if (elements.length >= 4)
				details.postCode = $.trim(elements[3]);
		}
		
		
		/// <summary>
		/// Convenience function for finding parts of the address
		/// </summary>
		function findPart(addressParts, typeName, getShortVersion) {
			if (addressParts == null || addressParts.length == 0) 
				// address not available
				return "";
				
			var value = "";

			for (var i=0; i < addressParts.length; i++)  {
				var item = addressParts[i],
						found = false
				;
				
				for (var j=0; j < item.types.length; j++) {
					var addrType = item.types[j];
					
					if (addrType.toLowerCase() == typeName.toLowerCase()) {
						found = true;						
						break;
					}
				} // types
				
				if (found) {
					value = (getShortVersion 
						? item.short_name
						: item.long_name
					);
					break;
				}
				
			}
			
			return value;
		
		} // findPart
		
		
		//
		// Initialisers
		//
		
		/// <summary>
		/// Constructor
		/// </summary>
		var ctor = function() {
			var containerId = null;

			// Set up Google API namespace references
			gm = google.maps;
			gp = google.maps.places;

			containerId = _mapContainer.attr("id");
			_gMap = new gm.Map( 
				document.getElementById(containerId), 
				settings.mapOptions
			);
			if (settings.disablePoi) {
				// Turns off Points-of-view 
				// ... (i.e. the default Google clicks you usually get in Google Maps)
				_plugIn.disablePointsOfInterest();
			}
			_placesApi = new gp.PlacesService(_gMap);
			_instance = _plugInInstances++;
			
			if (settings.onSelect) {
				_mapContainer.on("click", "button.mappy-select-button", 
					function() {
						var element = $(this);
						onPlaceSelect(element);
					}					
				);
			}
			if (settings.onSave) {
				_mapContainer.on("click", "button.mappy-save-button", 
					function() {
						var element = $(this);
						onPlaceSave(element);
					}					
				);
				// only allow edit if the user can actually save the result!
				_mapContainer.on("click", "button.mappy-edit-button", 
					function() {
						var element = $(this);
						onPlaceEdit(element);
					}					
				);
			}
			if (settings.onDelete) {
				_mapContainer.on("click", "button.mappy-delete-button",
					function() {
						var element = $(this);
						
						if (settings.confirmDelete) {
							var $vw = element.parents(".mappy-view");
							var model = getViewModel($vw);
							var msg = "<strong>" + model.name + "</strong> will be deleted."
							_plugIn.confirmMsg("Confirm Delete", msg, 
								"Are you sure?",
								// callback only fired if "Yes" is selected
								function() {
									onPlaceDelete(element);
								}
							);
						} else {
							onPlaceDelete(element);
						}
					}
				);
			}
			

			// position geo before the search bar (works better me thinks)
			if (settings.allowGeo) {
				addGeoLocationButton();
			}
			if (settings.searchOptions.enabled) {
				addSearch();
			}
			if (_fullWin || settings.onClose) {
				addCloseButton();
			}
			if (settings.showOnLoad != null) {
				addInitialPlaces();
			}
			if (settings.getHelpWindow) {
				addHelpButton();
			}
			if (settings.allowAdd) {
				addNewPlaceButton();
			}
			if (settings.onPreInit) {
				settings.onPreInit(_plugIn);
			}
			
			
			gm.event.addListener(_gMap, "tilesloaded", function(evt) {
				// tiles_loaded event is still too early to initialise the map
				// so give it another second to finish up before we initialise ourselves
				if (_hasMapInitFired)
					// already wired up
					return;

				gmMapLoaded();
				
				// flag it's been done
				_hasMapInitFired = true;
				
				if (settings.onInit) {
					settings.onInit(_plugIn);
				}
			});
			
			var so = settings.searchOptions;
			if (so.enabled && so.initSearch && so.initSearch.length > 0) {
				doSearch(so.initSearch);
			}

			if (!_areBoundsSet) {
				// Boundary hasn't been set (by adding a custom place for instance)
				// ... so apply the zoom and center (otherwise GM won't know where to draw it's map! and you'll just get a grey box)
				_gMap.setZoom(settings.mapOptions.zoom);
				_gMap.setCenter(settings.mapOptions.center);
			}

			var plugger = 'plugin_' + _plugInName;
			if (!_mapContainer.data(plugger)) {
				_mapContainer.data(plugger, _plugIn);
			}
			
		} // ctor
		
						
		// Selector entry point
		this.each(function () {
			_mapContainer = $(this);
			
			ctor();

		}); // each
		
		// Full screen entry point
		if (!this.length) {
			var mapId = "mappy-full-window",
					_mapContainer = $("#" + mapId)	// see if we've already added one
			;
			if (!_mapContainer.length) {
				_mapContainer = $("<div id='mappy-full-window' class='mappy-full-window'></div>");
				_mapContainer.appendTo("body");
			}
			// flag we're in full window mode
			_fullWin = true;
			
			ctor();				
		}
		
		// for jQuery chain-ability
		return this;
	}; // tooltips

})(jQuery);

