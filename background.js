chrome.action.onClicked.addListener(async (tab) => {
  // Sadece Scratch proje sayfalarında çalışsın
  if (!tab.url || !tab.url.includes("scratch.mit.edu/projects/")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => alert("Lütfen bir Scratch proje sayfasında kullanın!")
    });
    return;
  }

  // Kodu sayfaya enjekte et
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scratchThumbnailChanger
  });
});

// Sayfada çalışacak asıl fonksiyon
function scratchThumbnailChanger() {
  // Zaten açıksa tekrar açma
  if (document.getElementById("snackbar")) {
    document.getElementById("snackbar").style.visibility = "visible";
    return;
  }

  var projectID = document.location.pathname.replace(/\D/g, '');

  // Snackbar oluştur
  var snackbar = document.createElement("div");
  snackbar.id = "snackbar";
  snackbar.style.cssText = "visibility: hidden; min-width: 250px; margin-left: -125px; background-color: black; color: #fff; text-align: center; border-radius: 2px; padding: 16px; position: fixed; z-index: 99999; left: 50%; top: 50px; font-family: sans-serif;";
  snackbar.innerHTML = '<a id="selectThumbnailFile" style="color:#4d97ff;cursor:pointer;">Bir resim seç</a> veya sayfaya sürükle bırak.<br><a onclick="document.getElementById(\'snackbar\').style.visibility=\'hidden\';" style="color:#4d97ff;cursor:pointer;">Kapat</a>';
  document.body.appendChild(snackbar);
  snackbar.style.visibility = "visible";

  // Dosya input
  var fileInput = document.createElement("input");
  fileInput.id = "uploadthumbnail";
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  document.getElementById("selectThumbnailFile").onclick = function () {
    fileInput.click();
  };

  // Cookie oku
  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
  }

  // Yükleme fonksiyonu
  function uploadThumbnail(file) {
    snackbar.innerHTML = "Dosya okunuyor...";
    var reader = new FileReader();
    reader.onload = function (e) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/internalapi/project/thumbnail/" + projectID + "/set/", true);
      xhr.setRequestHeader("X-csrftoken", getCookie("scratchcsrftoken"));
      xhr.setRequestHeader("Content-Type", "");
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = Math.floor((e.loaded / e.total) * 100) + "%";
          snackbar.innerHTML = "Yükleniyor... " + progress;
        }
      };
      xhr.onload = function () {
        if (xhr.status === 200) {
          snackbar.innerHTML = 'Kapak başarıyla değiştirildi!<br><a onclick="document.getElementById(\'snackbar\').style.visibility=\'hidden\';" style="color:#4d97ff;cursor:pointer;">Kapat</a>';
        } else {
          snackbar.innerHTML = 'Hata: Yüklenemedi.<br><a onclick="document.getElementById(\'snackbar\').style.visibility=\'hidden\';" style="color:#4d97ff;cursor:pointer;">Kapat</a>';
        }
      };
      xhr.onerror = function () {
        snackbar.innerHTML = 'Hata: İstek gönderilemedi.<br><a onclick="document.getElementById(\'snackbar\').style.visibility=\'hidden\';" style="color:#4d97ff;cursor:pointer;">Kapat</a>';
      };
      xhr.send(e.target.result);
    };
    reader.readAsArrayBuffer(file);
  }

  fileInput.onchange = function () {
    if (fileInput.files[0]) uploadThumbnail(fileInput.files[0]);
  };

  // Sürükle bırak
  document.addEventListener("dragover", function (e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  document.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (e.dataTransfer.items[0]) {
      uploadThumbnail(e.dataTransfer.items[0].getAsFile());
    }
  });
}