var today = new Date()
var expiry = new Date(today.getTime() + 300 * 24 * 3600 * 1000) // plus 30 days

function setCookie (name, value) {
    document.cookie = name + '=' + escape(value) + '; path=/; expires=' + expiry.toGMTString()
}

function storeValues (form) {
    console.log("Storing  cookies.")
    setCookie('field1', form.field1.value)
    setCookie('field2', form.field2.value)
    setCookie('field3', form.field3.value)
    setCookie('field4', form.field4.value)
    setCookie('field5', form.field5.value)
    return true
}

if(field1 = getCookie("field1")) document.myForm.field1.value = field1;
if(field2 = getCookie("field2")) document.myForm.field2.value = field2;
if(field3 = getCookie("field3")) document.myForm.field3.value = field3;
if(field4 = getCookie("field4")) document.myForm.field4.value = field4;
if(field5 = getCookie("field5")) document.myForm.field5.value = field5; 

function submitUrl() {
    storeValues(document.myForm);
    let request = {
        "userName" : document.myForm.field1.value,
        "password" : document.myForm.field2.value,
        "fileUrl" : document.myForm.field3.value,
        "dmsUrl" : document.myForm.field4.value,
        "fileName" : document.myForm.field5.value
    }
    fetch("/webdav/process", {
        method: "POST", 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request)
    }).then(async res => {
        let data = await res.text();
        if (res.status === 200) {
            let json = JSON.parse(data);
            setCookie("fileId", json.fileId);
            alert("Submitted.Please use status button to view the status.")
        } else {
            alert("Something went wrong. " + data);
        }
    }).catch(error => {
        console.log(error);
        alert(error);
    });;
}

function getCookie(name) {
    var re = new RegExp(name + "=([^;]+)");
    var value = re.exec(document.cookie);
    return (value != null) ? unescape(value[1]) : null;
}

function getStatus() {
    fetch("/webdav/status/" + getCookie("fileId"), {
        method: "GET"
    }).then(async res => {
        let data = await res.text();
        if (res.status === 200) {
            let json = JSON.parse(data);
            if (json.status === "Success") {
                alert("File upload success.");
            }
            document.getElementById("statusDiv").innerHTML = data;
        } else {
            alert("Something went wrong.");
        }
    });
}