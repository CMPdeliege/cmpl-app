/* Protection contre le « clickjacking » : l'app refuse de s'afficher à l'intérieur d'un autre site.
   (GitHub Pages ne permet pas d'envoyer l'en-tête X-Frame-Options : cette protection le remplace.) */
(function(){
  var framed; try{ framed = window.self !== window.top; }catch(e){ framed = true; }
  if(!framed) return;
  document.documentElement.style.display = "none";
  try{ window.top.location.replace(window.self.location.href); }catch(e){}
})();
