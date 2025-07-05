(function () {
	'use strict';


	/* Bypass CSP restrictions (introduced by the latest Chrome updates)
	------------------------------------------------------------------------------------------ */
	if (window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) {
		window.trustedTypes.createPolicy('default', {
			createHTML: string => string,
			createScriptURL: string => string,
			createScript: string => string
		});
	}


	/* Helper functions
	------------------------------------------------------------------------------------------ */
	// Setup GET parameters
	function adBlock_helper_setupGetParams() {
		let getParams = {};

		document.location.search.replace(/\??(?:([^=]+)=([^&]*)&?)/g, function () {
			function decode(s) {
				return decodeURIComponent(s.split("+").join(" "));
			}

			getParams[decode(arguments[1])] = decode(arguments[2]);
		});

		return getParams;
	}

	// Set a cookie
	function adBlock_helper_setCookie(name, value) {
		// 399 days
		document.cookie = name + "=" + encodeURIComponent(value) + ";max-age=" + (399 * 24 * 60 * 60);
	}

	// Get a cookie
	function adBlock_helper_getCookie(name) {
		// Split the cookie string and get all individual name=value pairs in an array
		let cookies = document.cookie.split(";");

		// Loop through the array elements
		for (let i = 0; i < cookies.length; i++) {
			let cookie = cookies[i].split("=");

			// Removing whitespace at the beginning of the cookie name and compare it with the given string
			if (name == cookie[0].trim()) {
				// Decode the cookie value and return
				return decodeURIComponent(cookie[1]);
			}
		}

		// Return null if not found
		return null;
	}

	// Add CSS classes to show or hide elements / the Youtube player
	function adBlock_helper_showHide_init() {
		let style = document.createElement('style');
		style.textContent = `
			.adBlock_hidden {
				position: fixed !important;
				top: -9999px !important;
				left: -9999px !important;
				transform: scale(0) !important;
				pointer-events: none !important;
			}

			.adBlock_hiddenPlayer {
				position: relative;
				overflow: hidden;
				z-index: 1;
			}

			.adBlock_hiddenPlayer::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: #ffffff;
				z-index: 998;
			}

			html[dark] .adBlock_hiddenPlayer::before {
				background: #0f0f0f;
			}
		`;
		document.head.appendChild(style);
	}

	// Hide an element
	function adBlock_helper_hideElement(element) {
		if (element && !element.classList.contains('adBlock_hidden')) {
			element.classList.add('adBlock_hidden');
		}
	}

	// Show an element
	function adBlock_helper_showElement(element) {
		if (element && element.classList.contains('adBlock_hidden')) {
			element.classList.remove('adBlock_hidden');
		}
	}

	// Hide the Youtube player
	function adBlock_helper_hideYoutubePlayer(element) {
		// Add a wrapping div to help avoid detection
		if (!element.closest('.adBlock_hiddenPlayer')) {
			let parent = element.parentNode;
			let wrapper = document.createElement('div');
			wrapper.classList.add('adBlock_hiddenPlayer');
			parent.replaceChild(wrapper, element);
			wrapper.appendChild(element);
		}
	}


	/* Global variables
	------------------------------------------------------------------------------------------ */
	// A reference to our player's wrapper
	let adBlock_playerWrapper = false;

	// A reference to our player's iframe
	let adBlock_player = false;

	// The page api
	let adBlock_page_api = false;

	// The iframe api
	let adBlock_iframe_api = false;

	// Are we in picture in picture?
	let adBlock_pip = false;

	// Are we syncing the main Youtube player?
	let adBlock_syncingPlayer = false;

	// A reference to the previous URL (used to detect when the page changes)
	let adBlock_previousUrl = false;

	// Have we already turned off Youtube's default autoplay?
	let adBlock_turnedOffAutoplay = false;

	// Have we already redirected away from a short?
	let adBlock_redirectHappened = false;

	// Is this the first video we're loading?
	let adBlock_firstLoad = false;

	// A reference to a global timeout to check if our player has loaded
	let adBlock_loadTimeout = setTimeout(() => {}, 0);

	// Has the prox iframe loaded?
	let adBlock_proxyIframeLoaded = false;

	// Are shorts enabled?
	let adBlock_shorts = 'false';
	if (window.top === window.self) {
		adBlock_shorts = adBlock_helper_getCookie('adBlock_shorts');

		if (!adBlock_shorts) {
			adBlock_helper_setCookie('adBlock_shorts', 'false');
		}
	}

	// Is autoplay turned on?
	let adBlock_autoplay = adBlock_helper_getCookie('adBlock_autoplay');
	if (window.top === window.self) {
		if (!adBlock_autoplay) {
			adBlock_helper_setCookie('adBlock_autoplay', 'true');
			adBlock_autoplay = 'true';
		}
	}

	// Get the playback speed to restore it
	let adBlock_playbackSpeed = adBlock_helper_getCookie('adBlock_playbackSpeed');
	if (!adBlock_playbackSpeed) {
		adBlock_playbackSpeed = '1';
	}

	// Fetch the GET params
	let adBlock_getParams = adBlock_helper_setupGetParams();


	/* Youtube functions
	------------------------------------------------------------------------------------------ */
	// Hide ads and shorts
	function adBlock_youtube_hideAdsShortsEtc() {
		// Hide ads
		let style = document.createElement('style');
		style.textContent = `
			.ytd-search ytd-shelf-renderer,
			ytd-reel-shelf-renderer,
			ytd-merch-shelf-renderer,
			ytd-action-companion-ad-renderer,
			ytd-display-ad-renderer,

			ytd-video-masthead-ad-advertiser-info-renderer,
			ytd-video-masthead-ad-primary-video-renderer,
			ytd-in-feed-ad-layout-renderer,
			ytd-ad-slot-renderer,
			ytd-statement-banner-renderer,
			ytd-banner-promo-renderer-background
			ytd-ad-slot-renderer,
			ytd-in-feed-ad-layout-renderer,
			ytd-engagement-panel-section-list-renderer:not(.ytd-popup-container):not([target-id='engagement-panel-clip-create']):not(.ytd-shorts),
			ytd-compact-video-renderer:has(.adBlock_hidden),
			ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)
			.ytd-video-masthead-ad-v3-renderer,
			div#root.style-scope.ytd-display-ad-renderer.yt-simple-endpoint,
			div#sparkles-container.style-scope.ytd-promoted-sparkles-web-renderer,
			div#main-container.style-scope.ytd-promoted-video-renderer,
			div#player-ads.style-scope.ytd-watch-flexy,
			#clarify-box,
			ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer),

			ytm-rich-shelf-renderer,
			ytm-search ytm-shelf-renderer,
			ytm-button-renderer.icon-avatar_logged_out,
			ytm-companion-slot,
			ytm-reel-shelf-renderer,
			ytm-merch-shelf-renderer,
			ytm-action-companion-ad-renderer,
			ytm-display-ad-renderer,
			ytm-rich-section-renderer,
			ytm-video-masthead-ad-advertiser-info-renderer,
			ytm-video-masthead-ad-primary-video-renderer,
			ytm-in-feed-ad-layout-renderer,
			ytm-ad-slot-renderer,
			ytm-statement-banner-renderer,
			ytm-banner-promo-renderer-background
			ytm-ad-slot-renderer,
			ytm-in-feed-ad-layout-renderer,
			ytm-compact-video-renderer:has(.adBlock_hidden),
			ytm-rich-item-renderer:has(> #content > ytm-ad-slot-renderer)
			.ytm-video-masthead-ad-v3-renderer,
			div#root.style-scope.ytm-display-ad-renderer.yt-simple-endpoint,
			div#sparkles-container.style-scope.ytm-promoted-sparkles-web-renderer,
			div#main-container.style-scope.ytm-promoted-video-renderer,
			div#player-ads.style-scope.ytm-watch-flexy,
			ytd-compact-movie-renderer,

			yt-about-this-ad-renderer,
			masthead-ad,
			ad-slot-renderer,
			yt-mealbar-promo-renderer,
			statement-banner-style-type-compact,
			ytm-promoted-sparkles-web-renderer,
			tp-yt-iron-overlay-backdrop,
			#masthead-ad
			 {
				display: none !important;
			}

			.style-scope[page-subtype='channels'] ytd-shelf-renderer,
			.style-scope[page-subtype='channels'] ytm-shelf-renderer {
				display: block !important;
			}
		`;
		document.head.appendChild(style);

		// Debug message
		console.log('[adBlock] Ads removed');


		// Hide shorts if they're not enabled
		if (adBlock_shorts === 'false') {
			let shortsStyle = document.createElement('style');
			shortsStyle.textContent = `
				ytm-pivot-bar-item-renderer:has(> .pivot-shorts),
				ytd-rich-section-renderer,
				grid-shelf-view-model {
					display: none !important;
				}
			`;
			document.head.appendChild(shortsStyle);

			// Debug message
			console.log('[adBlock] Shorts removed');
		}
	}

	// Hide shorts (real time)
	function adBlock_youtube_hideShorts() {
		// Don't do this if shorts are enabled
		if (adBlock_shorts === 'true') {
			return;
		}

		// Hide shorts links
		let shortsLinks = document.querySelectorAll('a:not(.adBlock_hidden):not(.adBlock_checked)');
		shortsLinks.forEach((element) => {
			if (element.href.indexOf('shorts/') !== -1) {
				adBlock_helper_hideElement(element);
				adBlock_helper_hideElement(element.closest('ytd-video-renderer'));
				adBlock_helper_hideElement(element.closest('ytd-compact-video-renderer'));
				adBlock_helper_hideElement(element.closest('ytd-rich-grid-media'));
			}

			// Mark this element as checked to save on resources
			element.classList.add('adBlock_checked');
		});

		// Hide shorts buttons
		let shortsButtons = document.querySelectorAll('yt-chip-cloud-chip-renderer:not(.adBlock_hidden):not(.adBlock_checked), yt-tab-shape:not(.adBlock_hidden):not(.adBlock_checked)');
		shortsButtons.forEach((element) => {
			if (element.innerHTML.toLowerCase().indexOf('shorts') !== -1) {
				adBlock_helper_hideElement(element);
			}

			// Mark this element as checked to save on resources
			element.classList.add('adBlock_checked');
		});
	}

	// Support timestamp links in comments
	function adBlock_youtube_timestampLinks() {
		// Links in video description and comments
		let timestampLinks = document.querySelectorAll('#description a, ytd-comments .yt-core-attributed-string a, ytm-expandable-video-description-body-renderer a, .comment-content a');

		// For each link
		timestampLinks.forEach((element) => {
			// Make sure we've not touched it yet, this stops doubling up on event listeners
			if (!element.classList.contains('adBlock_timestampLink') && element.getAttribute('href') && element.getAttribute('href').indexOf(adBlock_getParams['v']) !== -1 && element.getAttribute('href').indexOf('t=') !== -1) {
				element.classList.add('adBlock_timestampLink');

				// Add the event listener to send our player to the correct time
				element.addEventListener('click', function () {
					let bits = element.getAttribute('href').split('t=');
					if (typeof bits[1] !== 'undefined') {
						let time = bits[1].replace('s', '');
						adBlock_player_skipTo(time);
					}
				});
			}
		});
	}

	// Hide all Youtube players
	function adBlock_youtube_hidePlayers() {
		// Don't do this if shorts are enabled and we're viewing a short
		if (adBlock_shorts === 'true' && window.location.href.indexOf('/shorts') !== -1) {
			return;
		}

		// Redirect from any short to the homepage
		if (window.location.href.indexOf('/shorts') !== -1 && !adBlock_redirectHappened) {
			window.location.href = 'https://youtube.com';
			adBlock_redirectHappened = true;
		}

		// Hide the normal Youtube player
		let regularPlayers = document.querySelectorAll('#player:not(.ytd-channel-video-player-renderer)');
		regularPlayers.forEach((element) => {
			adBlock_helper_hideYoutubePlayer(element);
		});

		// Remove the full screen and theater Youtube player
		let fullscreenPlayers = document.querySelectorAll('#full-bleed-container');
		fullscreenPlayers.forEach((element) => {
			adBlock_helper_hideYoutubePlayer(element);
		});

		// Hide the Youtube miniplayer
		let miniPlayers = document.querySelectorAll('ytd-miniplayer');
		miniPlayers.forEach((element) => {
			adBlock_helper_hideElement(element);
		});
	}

	// Mute and pause all Youtube videos
	function adBlock_youtube_mutePauseSkipAds() {
		// Don't do this if shorts are enabled and we're viewing a short
		if (adBlock_shorts === 'true' && window.location.href.indexOf('/shorts') !== -1) {
			return;
		}

		// Pause and mute all HTML videos on the page
		let youtubeVideos = document.querySelectorAll('video');
		youtubeVideos.forEach((element) => {
			// Don't touch the thumbnail hover player, main player or channel player
			if (!element.closest('#inline-player') && !element.closest('#movie_player') && !element.closest('.ytd-channel-video-player-renderer')) {
				element.muted = true;
				element.volume = 0;
				element.pause();
			}

			// If it's the main player and we're not syncing
			if (element.closest('#movie_player') && !adBlock_syncingPlayer) {
				element.muted = true;
				element.volume = 0;
				element.pause();
			}
		});
	}


	/* Player functions
	------------------------------------------------------------------------------------------ */
	// Init player
	function adBlock_player_init() {
		// Get the page API
		adBlock_page_api = document.getElementById('movie_player');

		// Get the video data to check loading state
		let videoData = false;
		if (adBlock_page_api && typeof adBlock_page_api.getVideoData === 'function') {
			videoData = adBlock_page_api.getVideoData();
		}

		// Keep trying to get the frame API until it exists
		if (!videoData) {
			setTimeout(adBlock_player_init, 100);
			return;
		}

		// Add CSS styles for the player
		let style = document.createElement('style');
		style.textContent = `
			/* Player wrapper */
			#adBlock_playerWrapper {
				border-radius: 12px;
				background: transparent;
				position: absolute;
				top: 0;
				left: 0;
				z-index: 999;
				overflow: hidden;
			}

			/* Theater mode */
			#adBlock_playerWrapper.adBlock_theater {
				background: #000000;
				border-radius: 0;
			}
		`;
		document.head.appendChild(style);

		// Setup player layout
		let playerWrapper = document.createElement('div');
		playerWrapper.id = 'adBlock_playerWrapper';

		// Add player to the page
		document.body.appendChild(playerWrapper);

		// Add video iframe embed (via proxy iframe)
		playerWrapper.innerHTML = `
			<iframe
				src="\x68\x74\x74\x70\x73\x3a\x2f\x2f\x65\x6e\x2e\x77\x69\x6b\x69\x70\x65\x64\x69\x61\x2e\x6f\x72\x67\x2f\x77\x69\x6b\x69\x2f\x46\x75\x63\x6b\x3f\x67\x6f\x6f\x64\x54\x75\x62\x65\x50\x72\x6f\x78\x79\x3d\x31"
				width="100%"
				height="100%"
				src=""
				frameborder="0"
				scrolling="yes"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
				style="display: none;"
			></iframe>
		`;

		// Expose the player and wrapper globally
		adBlock_playerWrapper = document.querySelector('#adBlock_playerWrapper');
		adBlock_player = adBlock_playerWrapper.querySelector('iframe');

		// Setup player dynamic positioning and sizing
		adBlock_player_positionAndSize();

		// Run the actions
		adBlock_actions();
	}

	// Position and size the player
	function adBlock_player_positionAndSize() {
		// If we're viewing a video
		if (window.location.href.indexOf('.com/watch') !== -1) {
			// Show the adBlock player
			adBlock_helper_showElement(adBlock_playerWrapper);

			// This is used to position and size the player
			let positionElement = false;

			// Theater mode
			if (document.querySelector('ytd-watch-flexy[theater]')) {
				positionElement = document.getElementById('player-full-bleed-container');

				if (!adBlock_playerWrapper.classList.contains('adBlock_theater')) {
					adBlock_playerWrapper.classList.add('adBlock_theater');
				}
			}
			// Regular mode
			else {
				positionElement = document.getElementById('player');

				if (adBlock_playerWrapper.classList.contains('adBlock_theater')) {
					adBlock_playerWrapper.classList.remove('adBlock_theater');
				}
			}

			// Position the player
			if (positionElement && positionElement.offsetHeight > 0) {
				// Our wrapper has "position: absolute" so take into account the window scroll
				let rect = positionElement.getBoundingClientRect();
				adBlock_playerWrapper.style.top = (rect.top + window.scrollY) + 'px';
				adBlock_playerWrapper.style.left = (rect.left + window.scrollX) + 'px';

				// Match the size of the position element
				adBlock_playerWrapper.style.width = positionElement.offsetWidth + 'px';
				adBlock_playerWrapper.style.height = positionElement.offsetHeight + 'px';
			}
		}

		// Call this function again on next draw frame (this must be done with setTimeout - it fixes a known major issue many users have where the function won't fire with window.requestAnimationFrame)
		setTimeout(adBlock_player_positionAndSize, 0);
	}

	// Load a video
	function adBlock_player_load() {
		// Pause the video first (this helps to prevent audio flashes)
		adBlock_player_pause();

		// Make sure the proxy iframe has loaded
		if (!adBlock_proxyIframeLoaded) {
			clearTimeout(adBlock_loadTimeout);
			adBlock_loadTimeout = setTimeout(adBlock_player_load, 100);
			return;
		}

		// Re fetch the page API
		adBlock_page_api = document.getElementById('movie_player');

		// Check if we're viewing a playlist (used for adBlock_src_xxx and adBlock_load_xxx below)
		let playlist = 'false';
		if (typeof adBlock_getParams['i'] !== 'undefined' || typeof adBlock_getParams['index'] !== 'undefined' || typeof adBlock_getParams['list'] !== 'undefined') {
			playlist = 'true';
		}

		// If we're loading for the first time
		if (!adBlock_firstLoad) {
			// If we're not viewing a video
			if (window.location.href.indexOf('.com/watch') === -1) {
				// Clear and hide the player
				adBlock_player_clear();
			}

			// Include the skip to time if it exists
			let skipToGetVar = '';
			if (typeof adBlock_getParams['t'] !== 'undefined') {
				skipToGetVar = '&start=' + adBlock_getParams['t'].replace('s', '');
			}

			// Set the video source
			adBlock_player.contentWindow.postMessage('adBlock_src_https://www.youtube.com/embed/' + adBlock_getParams['v'] + '?adBlockEmbed=1&autoplay=1&adBlock_playlist=' + playlist + '&adBlock_autoplay=' + adBlock_autoplay + '&adBlock_playbackSpeed=' + adBlock_playbackSpeed + skipToGetVar, '*');

			// Indicate we've completed the first load
			adBlock_firstLoad = true;
		}
		// Otherwise, for all other loads
		else {
			// Load the video via the iframe api
			let startTime = 0;
			if (typeof adBlock_getParams['t'] !== 'undefined') {
				startTime = adBlock_getParams['t'].replace('s', '');
			}
			adBlock_player.contentWindow.postMessage('adBlock_load_' + adBlock_getParams['v'] + '|||' + startTime + '|||' + playlist, '*');
		}


		// Show the player
		adBlock_helper_showElement(adBlock_playerWrapper);
	}

	// Clear and hide the player
	function adBlock_player_clear() {
		// Stop the video via the iframe api (but not if we're in picture in picture)
		if (!adBlock_pip) {
			adBlock_player.contentWindow.postMessage('adBlock_stopVideo', '*');
		}

		// Hide the player
		adBlock_helper_hideElement(adBlock_playerWrapper);
	}

	// Skip to time
	function adBlock_player_skipTo(time) {
		adBlock_player.contentWindow.postMessage('adBlock_skipTo_' + time, '*');
	}

	// Pause
	function adBlock_player_pause() {
		adBlock_player.contentWindow.postMessage('adBlock_pause', '*');
	}

	// Play
	function adBlock_player_play() {
		adBlock_player.contentWindow.postMessage('adBlock_play', '*');
	}


	/* Keyboard shortcuts
	------------------------------------------------------------------------------------------ */
	// Add keyboard shortcuts
	function adBlock_shortcuts_init() {
		document.addEventListener('keydown', function (event) {
			// Don't do anything if we're holding control
			if (event.ctrlKey) {
				return;
			}

			// Make sure we're watching a video
			if (window.location.href.indexOf('.com/watch') === -1) {
				return;
			}

			// Get the key pressed in lower case
			let keyPressed = event.key.toLowerCase();

			// If we're not focused on a HTML form element
			let focusedElement = event.srcElement;
			let focusedElement_tag = false;
			let focusedElement_id = false;
			if (focusedElement) {
				if (typeof focusedElement.nodeName !== 'undefined') {
					focusedElement_tag = focusedElement.nodeName.toLowerCase();
				}

				if (typeof focusedElement.getAttribute !== 'undefined') {
					focusedElement_id = focusedElement.getAttribute('id');
				}
			}

			if (
				!focusedElement ||
				(
					focusedElement_tag.indexOf('input') === -1 &&
					focusedElement_tag.indexOf('label') === -1 &&
					focusedElement_tag.indexOf('select') === -1 &&
					focusedElement_tag.indexOf('textarea') === -1 &&
					focusedElement_tag.indexOf('fieldset') === -1 &&
					focusedElement_tag.indexOf('legend') === -1 &&
					focusedElement_tag.indexOf('datalist') === -1 &&
					focusedElement_tag.indexOf('output') === -1 &&
					focusedElement_tag.indexOf('option') === -1 &&
					focusedElement_tag.indexOf('optgroup') === -1 &&
					focusedElement_id !== 'contenteditable-root'
				)
			) {
				if (
					// Speed up playback
					keyPressed === '>' ||
					// Slow down playback
					keyPressed === '<'
				) {
					event.preventDefault();
					event.stopImmediatePropagation();

					// Pass the keyboard shortcut to the iframe
					adBlock_player.contentWindow.postMessage('adBlock_shortcut_' + keyPressed, '*');
				}

				// If we're not holding down the shift key
				if (!event.shiftKey) {
					// If we're focused on the video element
					if (focusedElement && typeof focusedElement.closest !== 'undefined' && focusedElement.closest('#adBlock_player')) {
						// Theater mode (focus the body, this makes the default youtube shortcut work)
						if (keyPressed === 't') {
							document.querySelector('body').focus();
						}
					}

					if (
						// Prev frame (24fps calculation)
						keyPressed === ',' ||
						// Next frame (24fps calculation)
						keyPressed === '.' ||
						// Prev 5 seconds
						keyPressed === 'arrowleft' ||
						// Next 5 seconds
						keyPressed === 'arrowright' ||
						// Toggle play/pause
						keyPressed === ' ' || keyPressed === 'k' ||
						// Toggle mute
						keyPressed === 'm' ||
						// Toggle fullscreen
						keyPressed === 'f' ||
						// Toggle captions
						keyPressed === 'c' ||
						// Prev 10 seconds
						keyPressed === 'j' ||
						// Next 10 seconds
						keyPressed === 'l' ||
						// Start of video
						keyPressed === 'home' ||
						// End of video
						keyPressed === 'end' ||
						// Skip to percentage
						keyPressed === '0' ||
						keyPressed === '1' ||
						keyPressed === '2' ||
						keyPressed === '3' ||
						keyPressed === '4' ||
						keyPressed === '5' ||
						keyPressed === '6' ||
						keyPressed === '7' ||
						keyPressed === '8' ||
						keyPressed === '9'
					) {
						event.preventDefault();
						event.stopImmediatePropagation();

						// Pass the keyboard shortcut to the iframe
						adBlock_player.contentWindow.postMessage('adBlock_shortcut_' + keyPressed, '*');

						// Force mouse move to make sure fullscreen hides
						var event = new Event('mousemove');
						document.dispatchEvent(event);
					}

					// Toggle picture in picture
					if (keyPressed === 'i') {
						event.preventDefault();
						event.stopImmediatePropagation();

						// Tell the iframe to toggle pip
						adBlock_player.contentWindow.postMessage('adBlock_pip', '*');
					}
				}
			}
		}, true);
	}

	// Trigger a keyboard shortcut
	function adBlock_shortcuts_trigger(shortcut) {
		// Focus the body first
		document.querySelector('body').focus();

		// Setup the keyboard shortcut
		let theKey = false;
		let keyCode = false;
		let shiftKey = false;

		if (shortcut === 'theater') {
			theKey = 't';
			keyCode = 84;
			shiftKey = false;
		}
		else {
			return;
		}

		console.log('trigger ' + shortcut);

		// Trigger the keyboard shortcut
		let e = false;
		e = new window.KeyboardEvent('focus', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('keydown', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('beforeinput', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('keypress', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('input', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('change', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);

		e = new window.KeyboardEvent('keyup', {
			bubbles: true,
			key: theKey,
			keyCode: keyCode,
			shiftKey: shiftKey,
			charCode: 0,
		});
		document.dispatchEvent(e);
	}


	/* Navigation
	------------------------------------------------------------------------------------------ */
	// Play the next video
	function adBlock_nav_next() {
		// Re fetch the page API
		adBlock_page_api = document.getElementById('movie_player');

		// Make sure it exists
		if (adBlock_page_api && typeof adBlock_page_api.nextVideo === 'function') {
			// Play the next video
			adBlock_page_api.nextVideo();
		}

		// Debug message
		console.log('[adBlock] Playing next video...');
	}

	// Play the previous video
	function adBlock_nav_prev() {
		// Re fetch the page API
		adBlock_page_api = document.getElementById('movie_player');

		// Make sure it exists
		if (adBlock_page_api && typeof adBlock_page_api.nextVideo === 'function') {
			// Play the previous video
			adBlock_page_api.previousVideo();
		}

		// Debug message
		console.log('[adBlock] Playing previous video...');
	}

	// Video has ended
	function adBlock_nav_videoEnded() {
		// Re fetch the page API
		adBlock_page_api = document.getElementById('movie_player');

		// If autoplay is enabled
		if (adBlock_autoplay === 'true') {
			// Play the next video
			adBlock_nav_next();
		}
		// Otherwise, if we're viewing a playlist
		else if (typeof adBlock_page_api.getPlaylist === 'function' && typeof adBlock_page_api.getPlaylistIndex === 'function' && adBlock_page_api.getPlaylist()) {
			// Get the playlist
			let playlist = adBlock_page_api.getPlaylist();
			let playlistIndex = adBlock_page_api.getPlaylistIndex();

			// If we're NOT on the last video
			if (playlistIndex !== (playlist.length - 1)) {
				// Play the next video
				adBlock_nav_next();
			}
		}
	}

	// Show or hide the end screen
	function adBlock_nav_showHideEndScreen() {
		// Re fetch the page API
		adBlock_page_api = document.getElementById('movie_player');

		// Show the end screen
		let hideEndScreen = false;

		// If autoplay is on, hide the end screen
		if (adBlock_autoplay === 'true') {
			hideEndScreen = true;
		}

		// Otherwise, if we're viewing a playlist
		else if (typeof adBlock_page_api.getPlaylist === 'function' && typeof adBlock_page_api.getPlaylistIndex === 'function' && adBlock_page_api.getPlaylist()) {
			// Hide the end screen
			hideEndScreen = true;

			// Get the playlist
			let playlist = adBlock_page_api.getPlaylist();
			let playlistIndex = adBlock_page_api.getPlaylistIndex();

			// If we're on the last video
			if (playlistIndex === (playlist.length - 1)) {
				// Show the end screen
				hideEndScreen = false;
			}
		}

		// Hide the end screen
		if (hideEndScreen) {
			adBlock_player.contentWindow.postMessage('adBlock_endScreen_hide', '*');
		}
		// Otherwise show the end screen
		else {
			adBlock_player.contentWindow.postMessage('adBlock_endScreen_show', '*');
		}
	}


	/* Usage stats
	------------------------------------------------------------------------------------------ */
	// Don't worry everyone - this is just a counter that totals unique users / how many videos were played with adBlock.
	// It's only in here so I can have some fun and see how many people use this thing I made - no private info is tracked.

	// Count unique users
	function adBlock_stats_user() {
		// If there's no cookie
		if (!adBlock_helper_getCookie('adBlock_uniqueUserStat')) {
			// Count a unique user
			fetch('\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6a\x61\x6d\x65\x6e\x6c\x79\x6e\x64\x6f\x6e\x2e\x63\x6f\x6d\x2f\x5f\x6f\x74\x68\x65\x72\x2f\x73\x74\x61\x74\x73\x2f\x75\x73\x65\x72\x2e\x70\x68\x70');

			// Set a cookie to only count unique users once
			adBlock_helper_setCookie('adBlock_uniqueUserStat', 'true');
		}
	}

	// Count videos
	function adBlock_stats_video() {
		fetch('\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6a\x61\x6d\x65\x6e\x6c\x79\x6e\x64\x6f\x6e\x2e\x63\x6f\x6d\x2f\x5f\x6f\x74\x68\x65\x72\x2f\x73\x74\x61\x74\x73\x2f\x76\x69\x64\x65\x6f\x2e\x70\x68\x70');
	}


	/* Core functions
	------------------------------------------------------------------------------------------ */
	// Init
	function adBlock_init() {
		/* Disable Youtube
		-------------------------------------------------- */
		// Mute, pause and skip ads
		adBlock_youtube_mutePauseSkipAds();
		setInterval(adBlock_youtube_mutePauseSkipAds, 1);

		// Add CSS classes to hide elements (without Youtube knowing)
		adBlock_helper_showHide_init();

		// Hide the youtube players
		adBlock_youtube_hidePlayers();
		setInterval(adBlock_youtube_hidePlayers, 100);

		// Add CSS to hide ads, shorts, etc
		adBlock_youtube_hideAdsShortsEtc();

		// Hide shorts that popup as you use the site (like video results)
		setInterval(adBlock_youtube_hideShorts, 100);


		/* Load adBlock
		-------------------------------------------------- */
		// Init our player (after DOM is loaded)
		document.addEventListener('DOMContentLoaded', adBlock_player_init);

		// Also check if the DOM is already loaded, as if it is, the above event listener will not trigger
		if (document.readyState === 'interactive' || document.readyState === 'complete') {
			adBlock_player_init();
		}

		// Usage stats
		adBlock_stats_user();

		// Keyboard shortcuts
		adBlock_shortcuts_init();

		// Listen for messages from the iframe
		window.addEventListener('message', adBlock_receiveMessage);

		// Init the menu
		document.addEventListener('DOMContentLoaded', adBlock_menu);

		// Also check if the DOM is already loaded, as if it is, the above event listener will not trigger
		if (document.readyState === 'interactive' || document.readyState === 'complete') {
			adBlock_menu();
		}
	}

	// Listen for messages from the iframe
	function adBlock_receiveMessage(event) {
		// Make sure some data exists
		if (typeof event.data !== 'string') {
			return;
		}

		// Proxy iframe has loaded
		else if (event.data === 'adBlock_proxyIframe_loaded') {
			adBlock_proxyIframeLoaded = true;
		}

		// Player iframe has loaded
		else if (event.data === 'adBlock_playerIframe_loaded') {
			adBlock_player.style.display = 'block';
		}

		// Picture in picture
		if (event.data.indexOf('adBlock_pip_') !== -1) {
			let pipEnabled = event.data.replace('adBlock_pip_', '');

			if (pipEnabled === 'true') {
				adBlock_pip = true;
			}
			else {
				adBlock_pip = false;

				// If we're not viewing a video
				if (typeof adBlock_getParams['v'] === 'undefined') {
					// Clear the player
					adBlock_player_clear();
				}
			}
		}

		// Save the playback speed as a cookie
		else if (event.data.indexOf('adBlock_playbackSpeed_') !== -1) {
			adBlock_helper_setCookie('adBlock_playbackSpeed', event.data.replace('adBlock_playbackSpeed_', ''));
			adBlock_playbackSpeed = event.data.replace('adBlock_playbackSpeed_', '');
		}

		// Previous video
		else if (event.data === 'adBlock_prevVideo') {
			adBlock_nav_prev();
		}

		// Next video
		else if (event.data === 'adBlock_nextVideo') {
			adBlock_nav_next();
		}

		// Video has ended
		else if (event.data === 'adBlock_videoEnded') {
			adBlock_nav_videoEnded();
		}

		// Theater mode (toggle)
		else if (event.data === 'adBlock_theater') {
			adBlock_shortcuts_trigger('theater');
		}

		// Autoplay
		else if (event.data === 'adBlock_autoplay_false') {
			adBlock_helper_setCookie('adBlock_autoplay', 'false');
			adBlock_autoplay = 'false';
		}
		else if (event.data === 'adBlock_autoplay_true') {
			adBlock_helper_setCookie('adBlock_autoplay', 'true');
			adBlock_autoplay = 'true';
		}

		// Sync main player
		else if (event.data.indexOf('adBlock_syncMainPlayer_') !== -1) {
			// Target the youtube video element
			let youtubeVideoElement = document.querySelector('#movie_player video');

			// If we found the video element
			if (youtubeVideoElement) {
				// Parse the data
				let bits = event.data.replace('adBlock_syncMainPlayer_', '').split('_');
				let syncTime = parseFloat(bits[0]);
				let videoDuration = parseFloat(bits[1]);

				// Set a variable to indicate we're syncing the player (this stops the automatic pausing of all videos)
				adBlock_syncingPlayer = true;

				// Play the video via HTML
				youtubeVideoElement.play();
				youtubeVideoElement.muted = true;
				youtubeVideoElement.volume = 0;

				// Play the video via the frame API
				let youtubeFrameApi = document.querySelector('#movie_player');
				if (youtubeFrameApi) {
					if (typeof youtubeFrameApi.playVideo === 'function') {
						youtubeFrameApi.playVideo();
					}

					if (typeof youtubeFrameApi.mute === 'function') {
						youtubeFrameApi.mute();
					}

					if (typeof youtubeFrameApi.setVolume === 'function') {
						youtubeFrameApi.setVolume(0);
					}
				}

				// Make sure the durations match (we do NOT want to touch this if an ad is playing)
				if (videoDuration === youtubeVideoElement.duration) {
					// Sync the current time
					youtubeVideoElement.currentTime = syncTime;

					// After 10ms stop syncing (and let the pause actions handle the pausing)
					setTimeout(() => {
						adBlock_syncingPlayer = false;
					}, 10);
				}
			}
		}
	}

	// Actions
	function adBlock_actions() {
		// Get the previous and current URL

		// Remove hashes, these mess with things sometimes
		// Also remove "index="
		let previousUrl = adBlock_previousUrl;
		if (previousUrl) {
			previousUrl = previousUrl.split('#')[0];
			previousUrl = previousUrl.split('index=')[0];
		}

		let currentUrl = window.location.href;
		if (currentUrl) {
			currentUrl = currentUrl.split('#')[0];
			currentUrl = currentUrl.split('index=')[0];
		}

		// If the URL has changed (this will always fire on first page load)
		if (previousUrl !== currentUrl) {
			// The URL has changed, so setup our player
			// ----------------------------------------------------------------------------------------------------
			// Setup GET parameters
			adBlock_getParams = adBlock_helper_setupGetParams();

			// If we're viewing a video
			if (window.location.href.indexOf('.com/watch') !== -1) {
				// Load the video
				adBlock_player_load();

				// Usage stats
				adBlock_stats_video();
			}
			// Otherwise if we're not viewing a video
			else {
				// Clear the player
				adBlock_player_clear();
			}

			// Set the previous URL (which pauses this function until the URL changes again)
			adBlock_previousUrl = window.location.href;
		}

		// Show or hide the end screen
		adBlock_nav_showHideEndScreen();

		// Support timestamp links
		adBlock_youtube_timestampLinks();

		// Turn off autoplay
		adBlock_youtube_turnOffAutoplay();

		// Run actions again in 100ms to loop this function
		setTimeout(adBlock_actions, 100);
	}

	// Init menu
	function adBlock_menu() {
		// Create the menu container
		let menuContainer = document.createElement('div');

		// Add the menu container to the page
		document.body.appendChild(menuContainer);

		// Configure the settings to show their actual values
		let shortsEnabled = ' checked';
		if (adBlock_shorts === 'true') {
			shortsEnabled = '';
		}

		// Add content to the menu container
		menuContainer.innerHTML = `
			<!-- Menu Button
			==================================================================================================== -->
			<a href='javascript:;' class='adBlock_menuButton'>
				<img src='\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6a\x61\x6d\x65\x6e\x6c\x79\x6e\x64\x6f\x6e\x2e\x63\x6f\x6d\x2f\x5f\x6f\x74\x68\x65\x72\x2f\x73\x74\x61\x74\x73\x2f\x63\x72\x61\x62\x2e\x70\x6e\x67'>
			</a> <!-- .adBlock_menuButton -->
			<a href='javascript:;' class='adBlock_menuClose'>&#10006;</a>


			<!-- Modal
			==================================================================================================== -->
			<div class='adBlock_modal'>
				<div class='adBlock_modal_overlay'></div>

				<div class='adBlock_modal_inner'>
					<a class='adBlock_modal_closeButton' href='javascript:;'>&#10006;</a>

					<div class='adBlock_title'>Settings</div>
					<div class='adBlock_content'>
						<div class='adBlock_setting'>
							<input type='checkbox' class='adBlock_option_shorts' name='adBlock_option_shorts' id='adBlock_option_shorts'`+ shortsEnabled + `>
							<label for='adBlock_option_shorts'>Remove all Shorts from Youtube</label>
						</div> <!-- .adBlock_setting -->
						<button class='adBlock_button' id='adBlock_button_saveSettings'>Save and refresh</button>
					</div> <!-- .adBlock_content -->


					<div class='adBlock_title'>Make a donation <span class='adBlock_heart'>&#9829;</span></div>
					<div class='adBlock_content'>
						<div class='adBlock_donation'>
							<div class='adBlock_text'>
								<strong>This adblocker is 100% free to use and always will be.<br>
								It has helped thousands of people like you remove the unbearable ads from Youtube.</strong><br>
								<br>
								Countless hours and late nights have gone into making this and I continue to work on updating and maintaing the project every day. I am dedicated to ensuring this solution continues to work for everyone (despite Youtube's best efforts to stop adblockers).<br>
								<br>
								Any donation, no matter how small, helps to keep this project going and supports the community who use it. If you would like to say "thank you" and give something back, I would really appreciate it.
								<!--
								<br>
								<br>
								<i>Please note: All donations are processed through Paypal to provide you with the highest level of security.<br>
								You don't need a Paypal account to make a donation, it's just processed through their platform.</i>
								-->
							</div>
							<a href='https://tiptopjar.com/adBlock' target='_blank' rel='nofollow' class='adBlock_button'>Donate now</a>
						</div> <!-- .adBlock_donation -->
					</div> <!-- .adBlock_content -->


					<div class='adBlock_title'>FAQs</div>
					<div class='adBlock_content'>
						<div class='adBlock_text'>
							<strong>How can I share this with friends?</strong><br>
							You can send them <a href='https://github.com/adBlock4u/adBlock' target='_blank'>this link</a>. It has all of the install instructions.<br>
							<br>
							<strong>Do I need to manually update this?</strong><br>
							Nope, updates are pushed to you automatically so you don't have to do anything to use the latest version.<br>
							<br>
							<strong>Playlists skip to the next video every few seconds</strong><br>
							This is usually caused by another adblocker, userscript or extension you have installed. To fix this problem, disable all of your other adblockers, extensions and userscripts. Leave only Tampermonkey and this userscript enabled. Then refresh Youtube and check if the problem is fixed. If it's now working, turn on your other extensions and userscripts one by one until you find the one causing the issue.<br>
							<br>
							<strong>I can't watch a specific video</strong><br>
							This will work for 99% of videos. However it won't work for videos which are age restricted or have embedding disabled. You'll see a message come up if this happens. If you want to watch one of these, you'll have to disable this for a second. Sorry all, but there's no way around it currently with this alternative method of adblocking.<br>
							<br>
							<strong>I can't use the miniplayer</strong><br>
							The Youtube miniplayer is not supported. Instead this uses "Picture in Picture" mode, which works in most browsers / is the new standard for the web. Unfortunately Firefox does not support the Picture in Picture API, so the button is removed in Firefox until they decide to include this feature.
						</div>
					</div> <!-- .adBlock_content -->


					<div class='adBlock_title'>Report an issue</div>
					<div class='adBlock_content'>
						<div class='adBlock_text adBlock_successText'>Your message has been sent successfully.</div>
						<form class='adBlock_report' onSubmit='javascript:;'>
							<div class='adBlock_text'>I am dedicated to helping every single person get this working. Everyone is important and if you have any problems at all, please let me know. I will respond and do my best to help!</div>
							<input class='adBlock_reportEmail' type='email' placeholder='Email address' required>
							<textarea class='adBlock_reportText' placeholder='Enter your message here...\r\rPlease note - most reported issues are caused by a conflicting extension. Please first try turning off all of your other extensions. Refresh Youtube, check if the problem is fixed. If it is, then you know something is conflicting. Turn your other extensions back on one at a time until you find the cause. Please try this first before reporting an issue!' required></textarea>
							<input type='submit' class='adBlock_button' id='adBlock_button_submitReport' value='Submit'>
						</form> <!-- .adBlock_report -->
					</div> <!-- .adBlock_content -->


				</div> <!-- .adBlock_modal_inner -->
			</div> <!-- .adBlock_modal -->
		`;

		// Style the menu
		let style = document.createElement('style');
		style.textContent = `
			/* Menu button
			---------------------------------------------------------------------------------------------------- */
			.adBlock_menuButton {
				display: block;
				position: fixed;
				bottom: 16px;
				right: 16px;
				background: #0f0f0f;
				border-radius: 9999px;
				box-shadow: 0 0 10px rgba(0, 0, 0, .5);
				width: 48px;
				height: 48px;
				z-index: 999;
				transition: background .2s linear, box-shadow .2s linear, opacity .2s linear;
				opacity: 1;
			}

			.adBlock_menuButton img {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(round(-50%, 1px), round(-50%, 1px));
				pointer-events: none;
				width: 26px;
			}

			.adBlock_menuButton::before {
				content: 'Settings';
				background: rgba(0, 0, 0, .9);
				border-radius: 4px;
				color: #ffffff;
				font-size: 10px;
				font-weight: 700;
				text-transform: uppercase;
				padding-top: 4px;
				padding-bottom: 4px;
				padding-left: 8px;
				padding-right: 8px;
				position: absolute;
				left: 50%;
				top: -27px;
				transform: translate(round(-50%, 1px), 4px);
				letter-spacing: 0.04em;
				opacity: 0;
				transition: opacity .2s ease-in-out, transform .2s ease-in-out;
				pointer-events: none;
				text-decoration: none;
			}

			.adBlock_menuButton::after {
				content: '';
				position: absolute;
				top: -6px;
				left: 50%;
				transform: translate(round(-50%, 1px), 4px);
				width: 0;
				height: 0;
				border-left: 4px solid transparent;
				border-right: 4px solid transparent;
				border-top: 4px solid rgba(0, 0, 0, .9);
				opacity: 0;
				transition: opacity .2s ease-in-out, transform .2s ease-in-out;
				pointer-events: none;
				text-decoration: none;
			}

			.adBlock_menuButton:hover {
				background: #252525;
				box-shadow: 0 0 12px rgba(0, 0, 0, .5);
			}

			.adBlock_menuButton:hover::before,
			.adBlock_menuButton:hover::after {
				opacity: 1;
				transform: translate(round(-50%, 1px), 0);
			}

			.adBlock_menuClose {
				display: block;
				position: fixed;
				bottom: 51px;
				right: 16px;
				width: 14px;
				height: 14px;
				background: #ffffff;
				color: #000000;
				font-size: 9px;
				font-weight: 700;
				border-radius: 999px;
				text-align: center;
				line-height: 13px;
				z-index: 9999;
				box-shadow: 0 0 4px rgba(0, 0, 0, .5);
				transition: opacity .2s linear;
				opacity: 1;
				text-decoration: none;
			}


			/* Modal container
			---------------------------------------------------------------------------------------------------- */
			.adBlock_modal {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 9999;
				opacity: 0;
				transition: opacity .2s linear;
				pointer-events: none;
				backface-visibility: hidden;
			}
			.adBlock_modal:not(.visible) .adBlock_button {
				pointer-events: none;
			}

			.adBlock_modal.visible {
				pointer-events: all;
				opacity: 1;
			}
			.adBlock_modal.visible .adBlock_button {
				pointer-events: all;
			}

			.adBlock_modal * {
				box-sizing: border-box;
				padding: 0;
				margin: 0;
			}

			.adBlock_modal .adBlock_modal_overlay {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 1;
				background: rgba(0,0,0,.8);
			}

			.adBlock_modal .adBlock_modal_inner {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(round(-50%, 1px), round(-50%, 1px));
				width: 780px;
				max-width: calc(100% - 32px);
				max-height: calc(100% - 32px);
				z-index: 2;
				background: #ffffff;
				border-radius: 12px;
				box-shadow: 0 0 24px rgba(0, 0, 0, .5);
				font-family: Roboto, Arial, sans-serif;
				padding: 24px;
				overflow: auto;
			}

			.adBlock_modal .adBlock_modal_inner .adBlock_modal_closeButton {
				position: absolute;
				top: 12px;
				right: 12px;
				color: #333;
				font-size: 16px;
				font-weight: 700;
				text-decoration: none;
				width: 31px;
				height: 31px;
				background: #ffffff;
				border-radius: 9999px;
				text-align: center;
				line-height: 32px;
				transition: background .2s linear;
			}

			.adBlock_modal .adBlock_modal_inner .adBlock_modal_closeButton:hover {
				background: #dddddd;
			}


			/* Modal inner
			---------------------------------------------------------------------------------------------------- */
			.adBlock_modal .adBlock_title {
				font-weight: 700;
				font-size: 22px;
				padding-bottom: 16px;
			}

			.adBlock_modal .adBlock_content {
				padding-bottom: 24px;
				border-bottom: 1px solid #eeeeee;
				margin-bottom: 24px;
			}

			.adBlock_modal .adBlock_content:last-child {
				border-bottom: 0;
				margin-bottom: 0;
				padding-bottom: 0;
			}

			.adBlock_modal .adBlock_content .adBlock_setting {
				display: flex;
				gap: 12px;
				align-items: center;
				margin-bottom: 16px;
			}

			.adBlock_modal .adBlock_content .adBlock_setting input {
				width: 24px;
				height: 24x;
				min-width: 24px;
				min-height: 24px;
				border-radius: 4px;
				border: 1px solid #333;
				overflow: hidden;
				cursor: pointer;
			}

			.adBlock_modal .adBlock_content .adBlock_setting label {
				font-size: 15px;
				color: #000000;
				font-weight: 500;
				cursor: pointer;
			}

			.adBlock_modal .adBlock_button {
				all: initial;
				margin: 0;
				padding: 0;
				box-sizing: border-box;
				display: inline-block;
				background: #e84a82;
				color: #ffffff;
				text-align: center;
				font-size: 15px;
				font-weight: 700;
				padding-top: 12px;
				padding-bottom: 12px;
				padding-left: 18px;
				padding-right: 18px;
				letter-spacing: 0.024em;
				border-radius: 4px;
				font-family: Roboto, Arial, sans-serif;
				cursor: pointer;
				transition: background .2s linear;
			}

			.adBlock_modal .adBlock_button:hover {
				background: #fa5b93;
			}

			.adBlock_modal .adBlock_heart {
				color: #e01b6a;
				font-size: 24px;
			}

			.adBlock_modal .adBlock_text {
				display: block;
				font-size: 15px;
				padding-bottom: 16px;
				line-height: 130%;
			}

			.adBlock_modal .adBlock_text a {
				color: #e84a82;
				text-decoration: underline;
			}

			.adBlock_modal .adBlock_report {
			}

			.adBlock_modal .adBlock_successText {
				font-size: 15px;
				padding-bottom: 16px;
				line-height: 130%;
				display: none;
			}

			.adBlock_modal .adBlock_report input:not(.adBlock_button),
			.adBlock_modal .adBlock_report textarea {
				border-radius: 4px;
				border: 1px solid #999;
				width: 100%;
				font-size: 14px;
				color: #000000;
				padding-top: 12px;
				padding-bottom: 12px;
				padding-left: 16px;
				padding-right: 16px;
				font-family: Roboto, Arial, sans-serif;
				transition: border .2s linear;
			}

			.adBlock_modal .adBlock_report input:not(.adBlock_button)::placeholder,
			.adBlock_modal .adBlock_report textarea::placeholder {
				color: #666666;
			}

			.adBlock_modal .adBlock_report input:not(.adBlock_button):focus,
			.adBlock_modal .adBlock_report textarea:focus {
				border: 1px solid #333;
			}

			.adBlock_modal .adBlock_report input:not(.adBlock_button) {
				margin-bottom: 12px;
			}

			.adBlock_modal .adBlock_report textarea {
				margin-bottom: 16px;
				height: 128px;
			}
		`;
		document.head.appendChild(style);


		/* Menu button
		-------------------------------------------------- */
		// Target the elements
		let menuButton = document.querySelector('.adBlock_menuButton');
		let menuClose = document.querySelector('.adBlock_menuClose');

		// Support the close button
		if (menuClose) {
			menuClose.addEventListener('click', () => {
				menuButton.remove();
				menuClose.remove();
			});
		}


		/* Modal
		-------------------------------------------------- */
		// Target the elements
		let modal = document.querySelector('.adBlock_modal');
		let modalOverlay = document.querySelector('.adBlock_modal .adBlock_modal_overlay');
		let modalCloseButton = document.querySelector('.adBlock_modal .adBlock_modal_closeButton');

		// Open the modal
		if (menuButton) {
			menuButton.addEventListener('click', () => {
				if (modal) {
					// Reset the issue form
					let adBlock_reportForm = document.querySelector('.adBlock_report');
					if (adBlock_reportForm) {
						adBlock_reportForm.style.display = 'block';
					}

					let adBlock_reportSuccessText = document.querySelector('.adBlock_successText');
					if (adBlock_reportSuccessText) {
						adBlock_reportSuccessText.style.display = 'none';
					}

					let adBlock_reportEmail = document.querySelector('.adBlock_reportEmail');
					if (adBlock_reportEmail) {
						adBlock_reportEmail.value = '';
					}

					let adBlock_reportText = document.querySelector('.adBlock_reportText');
					if (adBlock_reportText) {
						adBlock_reportText.value = '';
					}

					// Show the modal
					modal.classList.add('visible');
				}
			});
		}

		// Close the modal
		if (modalOverlay) {
			modalOverlay.addEventListener('click', () => {
				if (modal && modal.classList.contains('visible')) {
					modal.classList.remove('visible');
				}
			});
		}

		if (modalCloseButton) {
			modalCloseButton.addEventListener('click', () => {
				if (modal && modal.classList.contains('visible')) {
					modal.classList.remove('visible');
				}
			});
		}

		document.addEventListener('keydown', (event) => {
			if (event.key.toLowerCase() === 'escape') {
				if (modal && modal.classList.contains('visible')) {
					modal.classList.remove('visible');
				}
			}
		});


		/* Settings
		-------------------------------------------------- */
		let adBlock_button_saveSettings = document.getElementById('adBlock_button_saveSettings');

		if (adBlock_button_saveSettings) {
			adBlock_button_saveSettings.addEventListener('click', () => {
				// Shorts
				let adBlock_setting_shorts = document.querySelector('.adBlock_option_shorts');
				if (adBlock_setting_shorts) {
					if (adBlock_setting_shorts.checked) {
						adBlock_helper_setCookie('adBlock_shorts', 'false');
					}
					else {
						adBlock_helper_setCookie('adBlock_shorts', 'true');
					}

					window.location.href = window.location.href;
				}
			});
		}


		/* Report an issue
		-------------------------------------------------- */
		let adBlock_reportForm = document.querySelector('.adBlock_report');
		let adBlock_reportSuccessText = document.querySelector('.adBlock_successText');

		if (adBlock_reportForm && adBlock_reportSuccessText) {
			adBlock_reportForm.addEventListener('submit', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();

				const params = {
					email: document.querySelector('.adBlock_reportEmail')?.value,
					message: document.querySelector('.adBlock_reportText')?.value
				};

				const options = {
					method: 'POST',
					body: JSON.stringify(params),
					headers: {
						'Content-Type': 'application/json; charset=UTF-8'
					}
				};

				fetch('\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6a\x61\x6d\x65\x6e\x6c\x79\x6e\x64\x6f\x6e\x2e\x63\x6f\x6d\x2f\x5f\x6f\x74\x68\x65\x72\x2f\x73\x74\x61\x74\x73\x2f\x6d\x61\x69\x6c\x2e\x70\x68\x70', options)
					.then(response => response.text())
					.then(response => {
						adBlock_reportForm.style.display = 'none';
						adBlock_reportSuccessText.style.display = 'block';
					});
			});
		}
	}

	// Turn off autoplay
	function adBlock_youtube_turnOffAutoplay() {
		// If we've already turned off autoplay, just return
		if (adBlock_turnedOffAutoplay) {
			return;
		}

		// Target the autoplay button
		let autoplayButton = document.querySelector('#movie_player .ytp-autonav-toggle-button');

		// If we found it
		if (autoplayButton) {
			// Set a variable if autoplay has been turned off
			if (autoplayButton.getAttribute('aria-checked') === 'false') {
				adBlock_turnedOffAutoplay = true;
				return;
			}
			// Otherwise click the button
			else {
				autoplayButton.click();
			}
		}
	}


	/* Iframe functions
	------------------------------------------------------------------------------------------ */
	// Init
	function adBlock_iframe_init() {
		// Get the iframe API
		adBlock_iframe_api = document.getElementById('movie_player');

		// Add the styles
		adBlock_iframe_style();

		// Get the video data to check loading state
		let videoData = false;
		if (adBlock_iframe_api && typeof adBlock_iframe_api.getVideoData === 'function') {
			videoData = adBlock_iframe_api.getVideoData();
		}

		// Keep trying to get the frame API until it exists
		if (!videoData) {
			setTimeout(adBlock_iframe_init, 100);
			return;
		}

		// Add custom buttons
		adBlock_iframe_addCustomButtons();

		// Add custom events
		adBlock_iframe_addCustomEvents();

		// Add keyboard shortcuts
		adBlock_iframe_addKeyboardShortcuts();

		// Support picture in picture
		adBlock_iframe_pip();

		// Sync the main player
		adBlock_iframe_syncMainPlayer();

		// Restore playback speed, and update it if it changes
		adBlock_iframe_playbackSpeed();

		// Run the iframe actions
		adBlock_iframe_actions();

		// Listen for messages from the parent window
		window.addEventListener('message', adBlock_iframe_receiveMessage);

		// Let the parent frame know it's loaded
		document.addEventListener('DOMContentLoaded', () => {
			window.top.postMessage('adBlock_playerIframe_loaded', '*');
		});

		// Also check if the DOM is already loaded, as if it is, the above event listener will not trigger
		if (document.readyState === 'interactive' || document.readyState === 'complete') {
			window.top.postMessage('adBlock_playerIframe_loaded', '*');
		}
	}

	// Actions
	function adBlock_iframe_actions() {
		// Fix fullscreen button issues
		adBlock_iframe_fixFullScreenButton();

		// Fix end screen links
		adBlock_iframe_fixEndScreenLinks();

		// Enable picture in picture next and prev buttons
		adBlock_iframe_enablePipButtons();

		// Run actions again in 100ms to loop this function
		setTimeout(adBlock_iframe_actions, 100);
	}

	// Restore playback speed, and update it if it changes
	function adBlock_iframe_playbackSpeed() {
		// Get the playback speed from the get variable
		if (typeof adBlock_getParams['adBlock_playbackSpeed'] !== 'undefined') {
			// Restore the playback speed
			if (adBlock_iframe_api && typeof adBlock_iframe_api.setPlaybackRate === 'function') {
				adBlock_iframe_api.setPlaybackRate(parseFloat(adBlock_getParams['adBlock_playbackSpeed']));
			}
		}

		// Update the playback speed cookie in the top frame every 100ms
		setInterval(() => {
			if (adBlock_iframe_api && typeof adBlock_iframe_api.getPlaybackRate === 'function') {
				// Tell the top frame to save the playback speed
				window.top.postMessage('adBlock_playbackSpeed_' + adBlock_iframe_api.getPlaybackRate(), '*');
			}
		}, 100);
	}

	// Fix end screen links (so they open in the same window)
	function adBlock_iframe_fixEndScreenLinks() {
		let endScreenLinks = document.querySelectorAll('.ytp-videowall-still');
		endScreenLinks.forEach(link => {
			// Remove any event listeners that Youtube adds
			link.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();

				// On click, redirect the top window to the correct location
				window.top.location.href = link.href;
			}, true);

			link.addEventListener('mousedown', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			}, true);

			link.addEventListener('mouseup', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			}, true);

			link.addEventListener('touchstart', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			}, true);

			link.addEventListener('touchend', (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			}, true);
		});
	}

	// Style the iframe
	function adBlock_iframe_style() {
		let style = document.createElement('style');

		let cssOutput = `
			/* Hide unwanted stuff */
			.ytp-gradient-top,
			.ytp-show-cards-title,
			.ytp-pause-overlay,
			.ytp-youtube-button,
			.ytp-cued-thumbnail-overlay,
			.ytp-paid-content-overlay,
			.ytp-impression-link,
			.ytp-ad-progress-list,
			.ytp-endscreen-next,
			.ytp-endscreen-previous,
			.ytp-info-panel-preview,
			.ytp-generic-popup,
			.adBlock_hideEndScreen .html5-endscreen {
				display: none !important;
			}

			.html5-endscreen {
				top: 0 !important;
			}

			/* Always show the next button */
			.ytp-next-button {
				opacity: 1 !important;
				cursor: pointer !important;
				display: block !important;
			}

			/* Show the prev button if it has the right class */
			.ytp-prev-button.adBlock_visible {
				opacity: 1 !important;
				cursor: pointer !important;
				display: block !important;
			}

			/* Show video title in fullscreen */
			body .ytp-fullscreen .ytp-gradient-top,
			body .ytp-fullscreen .ytp-show-cards-title {
				display: block !important;
			}
			body .ytp-fullscreen .ytp-show-cards-title .ytp-button,
			body .ytp-fullscreen .ytp-show-cards-title .ytp-title-channel {
				display: none !important;
			}
			body .ytp-fullscreen .ytp-show-cards-title .ytp-title-text {
				padding-left: 36px !important;
			}

			/* Add theater mode button */
			.ytp-size-button {
				display: inline-block !important;
			}
		`;

		// Enable the picture in picture button (unless you're on firefox)
		if (navigator.userAgent.toLowerCase().indexOf('firefox') === -1) {
			cssOutput += `
				.ytp-pip-button {
					display: inline-block !important;
				}
			`;
		}

		style.textContent = cssOutput;
		document.head.appendChild(style);
	}

	// Enable the previous button
	function adBlock_iframe_enablePrevButton() {
		let prevButton = document.querySelector('.ytp-prev-button');
		if (prevButton && !prevButton.classList.contains('adBlock_visible')) {
			prevButton.classList.add('adBlock_visible');
		}
	}

	// Disable the previous button
	function adBlock_iframe_disablePrevButton() {
		let prevButton = document.querySelector('.ytp-prev-button');
		if (prevButton && prevButton.classList.contains('adBlock_visible')) {
			prevButton.classList.remove('adBlock_visible');
		}
	}

	// Add custom buttons
	function adBlock_iframe_addCustomButtons() {
		// Target the play button
		let playButton = document.querySelector('.ytp-play-button');

		// Make sure it exists before continuing
		if (!playButton) {
			setTimeout(adBlock_iframe_addCustomButtons, 100);
			return;
		}


		// Previous button
		let prevButton = document.querySelector('.ytp-prev-button');
		if (prevButton) {
			// Add actions
			prevButton.addEventListener('click', function () {
				// Tell the top frame to go to the previous video
				window.top.postMessage('adBlock_prevVideo', '*');
			});
		}


		// Next button
		let nextButton = document.querySelector('.ytp-next-button');
		if (nextButton) {
			// Add actions
			nextButton.addEventListener('click', function () {
				// Tell the top frame to go to the next video
				window.top.postMessage('adBlock_nextVideo', '*');
			});
		}


		// Theater mode button
		let theaterButton = document.querySelector('.ytp-size-button');
		if (theaterButton) {
			// Style button
			theaterButton.setAttribute('data-tooltip-target-id', 'ytp-size-button');
			theaterButton.setAttribute('data-title-no-tooltip', 'Theater mode (t)');
			theaterButton.setAttribute('aria-label', 'Theater mode (t)');
			theaterButton.setAttribute('title', 'Theater mode (t)');
			theaterButton.innerHTML = '<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><use class="ytp-svg-shadow" xlink:href="#ytp-id-30"></use><path d="m 28,11 0,14 -20,0 0,-14 z m -18,2 16,0 0,10 -16,0 0,-10 z" fill="#fff" fill-rule="evenodd" id="ytp-id-30"></path></svg>';

			// Add actions
			theaterButton.addEventListener('click', function () {
				// Tell the top window to toggle theater mode
				window.top.postMessage('adBlock_theater', '*');
			});
		}


		// Add autoplay button (before subtitles button)
		let subtitlesButton = document.querySelector('.ytp-subtitles-button');
		if (subtitlesButton) {
			// Add button
			subtitlesButton.insertAdjacentHTML('beforebegin', '<button class="ytp-button" id="adBlock_autoplayButton" data-priority="2" data-tooltip-target-id="ytp-autonav-toggle-button"><div class="ytp-autonav-toggle-button-container"><div class="ytp-autonav-toggle-button" aria-checked="' + adBlock_getParams['adBlock_autoplay'] + '"></div></div></button>');

			// Add actions
			let autoplayButton = document.querySelector('#adBlock_autoplayButton');
			if (autoplayButton) {
				autoplayButton.addEventListener('click', function () {
					// Toggle the style of the autoplay button
					let innerButton = autoplayButton.querySelector('.ytp-autonav-toggle-button');
					let innerButtonState = innerButton.getAttribute('aria-checked');

					if (innerButtonState === 'true') {
						innerButton.setAttribute('aria-checked', 'false');
						window.top.postMessage('adBlock_autoplay_false', '*');
					}
					else {
						innerButton.setAttribute('aria-checked', 'true');
						window.top.postMessage('adBlock_autoplay_true', '*');
					}
				});
			}
		}
	}

	// Add custom events
	function adBlock_iframe_addCustomEvents() {
		// Target the video element
		let videoElement = document.querySelector('#player video');

		// Make sure it exists before continuing
		if (!videoElement) {
			setTimeout(adBlock_iframe_addCustomEvents, 100);
			return;
		}

		// When the video ends
		videoElement.addEventListener('ended', function () {
			// Tell the top frame the video ended
			window.top.postMessage('adBlock_videoEnded', '*');
		});
	}

	// Add keyboard shortcuts
	function adBlock_iframe_addKeyboardShortcuts() {
		document.addEventListener('keydown', function (event) {
			// Don't do anything if we're holding control
			if (event.ctrlKey) {
				return;
			}

			// Theater mode (t)
			if (event.key === 't') {
				// Tell the top window to toggle theater mode
				window.top.postMessage('adBlock_theater', '*');
			}

			// Picture in picture (i)
			if (event.key === 'i') {
				let pipButton = document.querySelector('.ytp-pip-button');
				if (pipButton) {
					pipButton.click();
				}
			}

			// Prev video (shift+p)
			else if (event.key.toLowerCase() === 'p' && event.shiftKey) {
				// Tell the top window to go to the previous video
				window.top.postMessage('adBlock_prevVideo', '*');
			}

			// Next video (shift+n)
			else if (event.key.toLowerCase() === 'n' && event.shiftKey) {
				// Tell the top window to go to the next video
				window.top.postMessage('adBlock_nextVideo', '*');
			}
		});
	}

	// Load a video
	function adBlock_iframe_loadVideo(videoId, startSeconds) {
		// Get the iframe API
		adBlock_iframe_api = document.getElementById('movie_player');

		// Make sure the API is ready
		if (adBlock_iframe_api && typeof adBlock_iframe_api.loadVideoById === 'function' && typeof adBlock_iframe_api.getVideoData === 'function') {
			// Load the video
			adBlock_iframe_api.loadVideoById(
				{
					'videoId': videoId,
					'startSeconds': startSeconds
				}
			);
		}
	}

	// Receive a message from the parent window
	function adBlock_iframe_receiveMessage(event) {
		// Make sure some data exists
		if (typeof event.data !== 'string') {
			return;
		}

		// Load video
		if (event.data.indexOf('adBlock_load_') !== -1) {
			let bits = event.data.replace('adBlock_load_', '').split('|||');
			let videoId = bits[0];
			let startSeconds = parseFloat(bits[1]);
			let viewingPlaylist = bits[2];

			// If we're on a playlist
			if (viewingPlaylist === 'true') {
				// Enable the previous button
				adBlock_iframe_enablePrevButton();
			}
			// Otherwise, we're not on a playlist
			else {
				// Disable the previous button
				adBlock_iframe_disablePrevButton();
			}

			// Then load the new video
			adBlock_iframe_loadVideo(videoId, startSeconds);
		}

		// Stop video
		else if (event.data === 'adBlock_stopVideo') {
			// Pause and mute the video
			adBlock_iframe_pause();
			adBlock_iframe_mute();
		}

		// Skip to time
		else if (event.data.indexOf('adBlock_skipTo_') !== -1) {
			let time = event.data.replace('adBlock_skipTo_', '');
			adBlock_iframe_skipTo(time);
		}

		// Pause
		else if (event.data === 'adBlock_pause') {
			adBlock_iframe_pause();
		}

		// Play
		else if (event.data === 'adBlock_play') {
			adBlock_iframe_play();
		}

		// Toggle picture in picture
		else if (event.data === 'adBlock_pip') {
			let pipButton = document.querySelector('.ytp-pip-button');
			if (pipButton) {
				pipButton.click();
			}
		}


		// Show or hide the end screen thumbnails
		else if (event.data === 'adBlock_endScreen_show') {
			if (document.body.classList.contains('adBlock_hideEndScreen')) {
				document.body.classList.remove('adBlock_hideEndScreen');
			}
		}
		else if (event.data === 'adBlock_endScreen_hide') {
			if (!document.body.classList.contains('adBlock_hideEndScreen')) {
				document.body.classList.add('adBlock_hideEndScreen');
			}
		}


		// Keyboard shortcut
		else if (event.data.indexOf('adBlock_shortcut_') !== -1) {
			// Get the key pressed
			let keyPressed = event.data.replace('adBlock_shortcut_', '');

			// Target the player
			let player = document.querySelector('video');
			if (!player) {
				return;
			}

			// Speed up playback
			else if (keyPressed === '>') {
				if (adBlock_iframe_api && typeof adBlock_iframe_api.getPlaybackRate === 'function' && typeof adBlock_iframe_api.setPlaybackRate === 'function') {
					let playbackRate = adBlock_iframe_api.getPlaybackRate();

					if (playbackRate == .25) {
						adBlock_iframe_api.setPlaybackRate(.5);
					}
					else if (playbackRate == .5) {
						adBlock_iframe_api.setPlaybackRate(.75);
					}
					else if (playbackRate == .75) {
						adBlock_iframe_api.setPlaybackRate(1);
					}
					else if (playbackRate == 1) {
						adBlock_iframe_api.setPlaybackRate(1.25);
					}
					else if (playbackRate == 1.25) {
						adBlock_iframe_api.setPlaybackRate(1.5);
					}
					else if (playbackRate == 1.5) {
						adBlock_iframe_api.setPlaybackRate(1.75);
					}
					else if (playbackRate == 1.75) {
						adBlock_iframe_api.setPlaybackRate(2);
					}
				}
			}

			// Slow down playback
			else if (keyPressed === '<') {
				if (adBlock_iframe_api && typeof adBlock_iframe_api.getPlaybackRate === 'function' && typeof adBlock_iframe_api.setPlaybackRate === 'function') {
					let playbackRate = adBlock_iframe_api.getPlaybackRate();

					if (playbackRate == .5) {
						adBlock_iframe_api.setPlaybackRate(.25);
					}
					else if (playbackRate == .75) {
						adBlock_iframe_api.setPlaybackRate(.5);
					}
					else if (playbackRate == 1) {
						adBlock_iframe_api.setPlaybackRate(.75);
					}
					else if (playbackRate == 1.25) {
						adBlock_iframe_api.setPlaybackRate(1);
					}
					else if (playbackRate == 1.5) {
						adBlock_iframe_api.setPlaybackRate(1.25);
					}
					else if (playbackRate == 1.75) {
						adBlock_iframe_api.setPlaybackRate(1.5);
					}
					else if (playbackRate == 2) {
						adBlock_iframe_api.setPlaybackRate(1.75);
					}
				}
			}

			// If we're not holding down the shift key
			if (!event.shiftKey) {
				// Prev frame (24fps calculation)
				if (keyPressed === ',') {
					if (player.paused || player.ended) {
						player.currentTime -= 0.04166666666666667;
					}
				}

				// Next frame (24fps calculation)
				if (keyPressed === '.') {
					if (player.paused || player.ended) {
						player.currentTime += 0.04166666666666667;
					}
				}

				// Prev 5 seconds
				if (keyPressed === 'arrowleft') {
					player.currentTime -= 5;
				}

				// Next 5 seconds
				if (keyPressed === 'arrowright') {
					player.currentTime += 5;
				}

				// Toggle play/pause
				if (keyPressed === ' ' || keyPressed === 'k') {
					if (player.paused || player.ended) {
						player.play();
					}
					else {
						player.pause();
					}
				}

				// Toggle mute
				if (keyPressed === 'm') {
					document.querySelector('.ytp-mute-button').click();
				}

				// Toggle fullscreen
				if (keyPressed === 'f') {
					let fullScreenButton = document.querySelector('.ytp-fullscreen-button');

					if (fullScreenButton) {
						fullScreenButton.click();
					}

					// Force mouse move to make sure fullscreen hides
					var event = new Event('mousemove');
					document.dispatchEvent(event);
				}

				// Toggle captions
				if (keyPressed === 'c') {
					let captionsButton = document.querySelector('.ytp-subtitles-button');

					if (captionsButton) {
						captionsButton.click();
					}
				}

				// Prev 10 seconds
				else if (keyPressed === 'j') {
					player.currentTime -= 10;
				}

				// Next 10 seconds
				else if (keyPressed === 'l') {
					player.currentTime += 10;
				}

				// Start of video
				else if (keyPressed === 'home') {
					player.currentTime = 0;
				}

				// End of video
				else if (keyPressed === 'end') {
					player.currentTime += player.duration;
				}

				// Skip to percentage
				if (keyPressed === '0') {
					player.currentTime = 0;
				}
				else if (keyPressed === '1') {
					player.currentTime = ((player.duration / 100) * 10);
				}
				else if (keyPressed === '2') {
					player.currentTime = ((player.duration / 100) * 20);
				}
				else if (keyPressed === '3') {
					player.currentTime = ((player.duration / 100) * 30);
				}
				else if (keyPressed === '4') {
					player.currentTime = ((player.duration / 100) * 40);
				}
				else if (keyPressed === '5') {
					player.currentTime = ((player.duration / 100) * 50);
				}
				else if (keyPressed === '6') {
					player.currentTime = ((player.duration / 100) * 60);
				}
				else if (keyPressed === '7') {
					player.currentTime = ((player.duration / 100) * 70);
				}
				else if (keyPressed === '8') {
					player.currentTime = ((player.duration / 100) * 80);
				}
				else if (keyPressed === '9') {
					player.currentTime = ((player.duration / 100) * 90);
				}
			}
		}
	}

	// Skip to time
	function adBlock_iframe_skipTo(time) {
		// Target the video
		let videoElement = document.querySelector('video');

		// If the video exists, restore the time
		if (videoElement) {
			videoElement.currentTime = parseFloat(time);
		}
		// Otherwise retry until the video exists
		else {
			setTimeout(adBlock_iframe_skipTo, 100);
		}
	}

	// Pause
	function adBlock_iframe_pause() {
		// Target the video
		let videoElement = document.querySelector('video');

		// If the video exists, pause it
		if (videoElement) {
			videoElement.pause();
		}
		// Otherwise retry until the video exists
		else {
			setTimeout(adBlock_iframe_pause, 100);
		}
	}

	// Mute
	function adBlock_iframe_mute() {
		// Target the video
		let videoElement = document.querySelector('video');

		// If the video exists, mute it
		if (videoElement) {
			videoElement.muted = true;
		}
		// Otherwise retry until the video exists
		else {
			setTimeout(adBlock_iframe_mute, 100);
		}
	}

	// Unmute
	function adBlock_iframe_unmute() {
		// Target the video
		let videoElement = document.querySelector('video');

		// If the video exists, unmute it
		if (videoElement) {
			videoElement.muted = false;
		}
		// Otherwise retry until the video exists
		else {
			setTimeout(adBlock_iframe_unmute, 100);
		}
	}

	// Play
	function adBlock_iframe_play() {
		// Target the video
		let videoElement = document.querySelector('video');

		// If the video exists, restore the time
		if (videoElement) {
			videoElement.play();
		}
		// Otherwise retry until the video exists
		else {
			setTimeout(adBlock_iframe_pause, 100);
		}
	}

	// Fix fullscreen button issues
	function adBlock_iframe_fixFullScreenButton() {
		let fullScreenButton = document.querySelector('.ytp-fullscreen-button');
		if (fullScreenButton) {
			fullScreenButton.setAttribute('aria-disabled', 'false');

			if (document.querySelector('.ytp-fullscreen')) {
				fullScreenButton.setAttribute('title', 'Exit full screen (f)');
			}
			else {
				fullScreenButton.setAttribute('title', 'Full screen (f)');
			}
		}
	}

	// Sync the main player
	function adBlock_iframe_syncMainPlayer() {
		// If we're viewing a video page
		if (window.top.location.href.indexOf('.com/watch') !== -1) {
			let videoElement = document.querySelector('video');

			if (videoElement) {
				// Tell the parent frame to sync the video (pass in the time we want to sync to and the total video duration - we use the duration to detect if an ad is playing)
				window.top.postMessage('adBlock_syncMainPlayer_' + videoElement.currentTime + '_' + videoElement.duration, '*');
			}
		}

		setTimeout(adBlock_iframe_syncMainPlayer, 5000);
	}

	// Support picture in picture
	function adBlock_iframe_pip() {
		// If we leave the picture in picture
		addEventListener('leavepictureinpicture', (event) => {
			adBlock_pip = false;

			// Set the picture in picture state in the top window
			window.top.postMessage('adBlock_pip_false', '*');
		});

		// If we enter the picture in picture
		addEventListener('enterpictureinpicture', (event) => {
			adBlock_pip = true;

			// Set the picture in picture state in the top window
			window.top.postMessage('adBlock_pip_true', '*');
		});
	}

	// Enable picture in picture next and prev buttons
	function adBlock_iframe_enablePipButtons() {
		if ("mediaSession" in navigator) {
			// Next video
			navigator.mediaSession.setActionHandler("nexttrack", () => {
				// Tell the top frame to go to the next video
				window.top.postMessage('adBlock_nextVideo', '*');
			});

			// Previous video
			navigator.mediaSession.setActionHandler("previoustrack", () => {
				// Tell the top frame to go to the previous video
				window.top.postMessage('adBlock_prevVideo', '*');
			});
		}
	}


	/* Proxy iframe functions
	------------------------------------------------------------------------------------------ */
	// Init
	function adBlock_proxyIframe_init() {
		// Wait for the DOM to load
		document.addEventListener("DOMContentLoaded", adBlock_proxyIframe_initLoaded);

		// Also check if the DOM is already loaded, as if it is, the above event listener will not trigger
		if (document.readyState === "interactive" || document.readyState === "complete") {
			adBlock_proxyIframe_initLoaded();
		}
	}

	function adBlock_proxyIframe_initLoaded() {
		// Hide the DOM elements from the proxy page
		let elements = document.querySelectorAll('body > *');
		elements.forEach(element => {
			element.style.display = 'none';
			element.style.opacity = '0';
			element.style.visibility = 'hidden';
		});

		// Remove scrolling
		document.body.style.overflow = 'hidden';

		// Change the background colour
		document.body.style.background = '#000000';

		// Create a youtube iframe
		let youtubeIframe = document.createElement('div');

		// Add the youtube iframe to the page
		document.body.appendChild(youtubeIframe);

		// Update the content of the youtube iframe
		youtubeIframe.innerHTML = `
			<iframe
				width="100%"
				height="100%"
				src=""
				frameborder="0"
				scrolling="yes"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
				id="adBlock_youtube_iframe"
			></iframe>
		`;

		// Style the youtube iframe
		youtubeIframe.style.position = 'fixed';
		youtubeIframe.style.top = '0';
		youtubeIframe.style.bottom = '0';
		youtubeIframe.style.right = '0';
		youtubeIframe.style.left = '0';
		youtubeIframe.style.zIndex = '99999';

		// Listen for messages from the parent window
		window.addEventListener('message', adBlock_proxyIframe_receiveMessage);

		// Let the parent frame know it's loaded
		window.top.postMessage('adBlock_proxyIframe_loaded', '*');
	}

	// Receive a message from the parent window
	function adBlock_proxyIframe_receiveMessage(event) {
		// Make sure some data exists
		if (typeof event.data !== 'string') {
			return;
		}

		// Target the youtube iframe
		let youtubeIframe = document.getElementById('adBlock_youtube_iframe');

		// Make sure we found the youtube iframe
		if (youtubeIframe) {
			// Change the source of the youtube iframe
			if (event.data.indexOf('adBlock_src_') !== -1) {
				// First time just change the src
				if (youtubeIframe.src === '' || youtubeIframe.src.indexOf('?adBlockProxy=1') !== -1) {
					youtubeIframe.src = event.data.replace('adBlock_src_', '');
				}
				// All other times, we need to use this weird method so it doesn't mess with our browser history
				else {
					youtubeIframe.contentWindow.location.replace(event.data.replace('adBlock_src_', ''));
				}

				// Enable the previous button if a playlist get variable was passed in
				if (youtubeIframe.src.indexOf('?adBlock_playlist=true') !== -1) {
					adBlock_iframe_enablePrevButton();
				}
			}
			// Pass all other messages down to the youtube iframe
			else {
				youtubeIframe.contentWindow.postMessage(event.data, '*');
			}
		}
	}


	/* Start adBlock
	------------------------------------------------------------------------------------------ */
	// Youtube page
	if (window.top === window.self && window.location.href.indexOf('youtube') !== -1) {
		adBlock_init();
	}
	// Proxy iframe embed
	else if (window.location.href.indexOf('?adBlockProxy=1') !== -1) {
		adBlock_proxyIframe_init();
	}
	// Iframe embed
	else if (window.location.href.indexOf('?adBlockEmbed=1') !== -1) {
		adBlock_iframe_init();
	}

})();
