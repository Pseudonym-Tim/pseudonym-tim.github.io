const body = document.body

const btnHamburger = document.querySelector('.fa-bars')

const addThemeClass = (bodyClass, btnClass) => {
  body.classList.add(bodyClass)
  btnTheme.classList.add(btnClass)
}

const displayList = () => {
	const navUl = document.querySelector('.nav_list')

	if (btnHamburger.classList.contains('fa-bars')) {
		btnHamburger.classList.remove('fa-bars')
		btnHamburger.classList.add('fa-times')
		navUl.classList.add('display-nav-list')
	} else {
		btnHamburger.classList.remove('fa-times')
		btnHamburger.classList.add('fa-bars')
		navUl.classList.remove('display-nav-list')
	}
}

btnHamburger.addEventListener('click', displayList)

// Automatically calculate height and offset for nav link section scroll...
document.addEventListener("DOMContentLoaded", function() {
    // Get the height of the header...
    let headerHeight = document.querySelector(".header").offsetHeight;
	const heightOffset = 25;
  
    // Set the scroll-margin for all sections...
    let sections = document.querySelectorAll(".section");
    sections.forEach(function(section) {
        section.style.scrollMarginTop = headerHeight + heightOffset + "px";
    });
});

const scrollUp = () => {
	const btnScrollTop = document.querySelector('.scroll-top')
	
	if (body.scrollTop > 500 || document.documentElement.scrollTop > 500) 
	{
		btnScrollTop.style.display = 'block'
	} 
	else 
	{
		btnScrollTop.style.display = 'none'
	}
}

document.addEventListener('scroll', scrollUp)

function audioPlayer() {
    var currentSong = 0;
    $("#audioPlayer")[0].src = $("#playlist li a")[0];

    $("#playlist li a").click(function(e) {
        e.preventDefault();

        // Check if clicked song is the current song
        if ($("#audioPlayer")[0].src == this.href && !$("#audioPlayer")[0].paused) {
            // Reset the player
            $("#audioPlayer")[0].currentTime = 0;
            $("#audioPlayer")[0].pause();
            // Remove the class for current song
            $(this).parent().removeClass("current-song");
        } else {
            $("#audioPlayer")[0].src = this;
            $("#audioPlayer")[0].play();
            $("#playlist li").removeClass("current-song");
            currentSong = $(this).parent().index();
            $(this).parent().addClass("current-song");
        }
    });

    $("#audioPlayer")[0].addEventListener("ended", function() {
        currentSong++;

        if (currentSong == $("#playlist li a").length) { currentSong = 0; }

        $("#playlist li").removeClass("current-song");
        $("#playlist li:eq(" + currentSong + ")").addClass("current-song");
        $("#audioPlayer")[0].src = $("#playlist li a")[currentSong].href;
        $("#audioPlayer")[0].play();
    });
}
