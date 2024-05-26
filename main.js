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
        button.innerHTML = '<i class="fas fa-stop"></i> Stop "' + trackName + '"';
        button.classList.add('active');
        currentButton = button;
    }
}
