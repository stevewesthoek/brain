Webshare API CSS

<!-- HEADER SCROLL -->

<script>
document.addEventListener('DOMContentLoaded', function() {
	    document.addEventListener('scroll', function() {
		        let y = window.scrollY;
		        let menuhopin = document.getElementById('menuhopin');
		        if (y > 50) { /* change this value here to make it show up at your desired scroll location. */
			            menuhopin.classList.add('headershow');
		        } else {
			            menuhopin.classList.remove('headershow');
		        }
	    });
});
</script>
<style>
.elementor-nav-menu__container{
	top:0px!important;
}
#menuhopin.headershow{
	transform: translateY(0);
}
#menuhopin{
	position: fixed;
	top:0;
	width: 100%;
	-webkit-transition: transform 0.34s ease;
	transition : transform 0.34s ease;
	transform: translateY(-110px); /*adjust this value to the height of your header*/
}
</style>

WEB SHARE API

<script>
const shareBtn = document.getElementById('shareBtn')

shareBtn.addEventListener('click', event => {
	
	  // Check for Web Share api support
	  if (navigator.share) {
		    // Browser supports native share api
		    navigator.share({
			      text: 'Lean Diet Links',
			      url: 'https://www.lean.diet/links/'
		    }).then(() => {
			      console.log('Thanks for sharing!');
		    })
		      .catch((err) => console.error(err));
	  } else {
		    // Fallback
		    alert("The current browser does not support the share function. Please, manually share the link")
	  }
});
</script>


/* Slide In From The Top Option */

.header-2 {
	 transform: translatey(-70px);
	 -moz-transition: all .6s ease!important;
	 -webkit-transition: all .6s ease!important;
	 transition: all .6s ease!important;
	 
	   backdrop-filter: blur(5px);
	  -webkit-backdrop-filter: blur(10px);
}

elementor-sticky--effects.header-2  {
	 height: auto!important;
	 transform: translatey(0px);
	 
}

.elementor-sticky--effects.header-1 {
	 display: none!important;
}


/* End Of Slide In From The Top Option */

selector {
	  position: fixed;
	  top: 0;
	  width: 345px;
	  margin: 0;
	  padding: 0;
	  z-index: 9999;
	  --e-transform-transition-duration: 500ms;
	  transition: all 500ms ease-in-out;
}

selector.header-1 {
	  background-color: #000;
	  color: #fff;
	  padding: 10px;
}

selector.header-2 {
	  background-color: #fff;
	  color: #000;
	  padding: 20px;
}