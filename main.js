document.addEventListener("DOMContentLoaded", function() {
    const navLinks = document.getElementById('nav-links');
    const hamburger = document.getElementById('hamburger');
    const links = navLinks.querySelectorAll('a');

    hamburger.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href.startsWith('#')) { // Check if the href is an internal link
                e.preventDefault();

                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);

                window.scrollTo({
                    top: targetElement.offsetTop - document.querySelector('.navbar').offsetHeight,
                    behavior: 'smooth'
                });
            }

            // Hide the dropdown menu after clicking a link
            navLinks.classList.remove('active');
        });
    });

    setupArtViewer();
});

let currentTrack = null;
let currentTrackName = '';
let currentButton = null;

function playMusic(track, trackName, button) {
    if (currentTrack && currentTrackName === trackName) {
        currentTrack.pause();
        currentTrack.currentTime = 0;
        currentTrack = null;
        currentTrackName = '';
        button.querySelector('i').classList.remove('fa-stop');
        button.querySelector('i').classList.add('fa-play');
        button.innerHTML = '<i class="fas fa-play"></i> Play "' + trackName + '"';
        button.classList.remove('active');
    } else {
        if (currentTrack) {
            currentTrack.pause();
            if (currentButton) {
                currentButton.querySelector('i').classList.remove('fa-stop');
                currentButton.querySelector('i').classList.add('fa-play');
                currentButton.innerHTML = '<i class="fas fa-play"></i> Play "' + currentTrackName + '"';
                currentButton.classList.remove('active');
            }
        }
        currentTrack = new Audio(track);
        currentTrack.play();
        currentTrackName = trackName;
        button.querySelector('i').classList.remove('fa-play');
        button.querySelector('i').classList.add('fa-stop');
        button.innerHTML = '<i class="fas fa-stop"></i> Stop playing "' + trackName + '"';
        button.classList.add('active');
        currentButton = button;
    }
}


function setupArtViewer() {
    const viewer = document.getElementById("artViewer");
    const viewerImage = document.getElementById("artViewerImage");
    const viewerClose = document.getElementById("artViewerClose");
    const viewerTitle = document.getElementById("artViewerTitle");
    const triggers = document.querySelectorAll("[data-art-viewer-image]");
    let previousFocusedElement = null;

    if (!viewer || !viewerImage || !viewerClose || !viewerTitle || triggers.length === 0) {
        return;
    }

    function openViewer(trigger) {
        const imageSource = trigger.getAttribute("data-art-viewer-image");
        const imageTitle = trigger.getAttribute("data-art-viewer-title") || "Artwork preview";

        if (!imageSource) {
            return;
        }

        previousFocusedElement = trigger;
        viewerImage.src = imageSource;
        viewerImage.alt = imageTitle;
        viewerTitle.textContent = imageTitle;
        viewer.classList.add("is-open");
        viewer.setAttribute("aria-hidden", "false");
        document.body.classList.add("body--art-viewer-open");

        window.requestAnimationFrame(function () {
            viewerClose.focus();
        });
    }

    function closeViewer() {
        viewer.classList.remove("is-open");
        viewer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("body--art-viewer-open");

        window.setTimeout(function () {
            if (!viewer.classList.contains("is-open")) {
                viewerImage.src = "";
                viewerImage.alt = "";
            }
        }, 260);

        if (previousFocusedElement instanceof HTMLElement) {
            previousFocusedElement.focus();
        }
    }

    triggers.forEach(function (trigger) {
        trigger.addEventListener("click", function () {
            openViewer(trigger);
        });
    });

    viewerClose.addEventListener("click", closeViewer);

    viewer.querySelectorAll("[data-art-viewer-close]").forEach(function (element) {
        element.addEventListener("click", closeViewer);
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && viewer.classList.contains("is-open")) {
            closeViewer();
        }
    });
}

