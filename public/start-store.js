const form=document.querySelector('#start-store');
const errorField=form.querySelector('[role=alert]');
form.onsubmit=async event=>{
 event.preventDefault();
 const submit=form.querySelector('button');
 errorField.textContent='';
 submit.disabled=true;
 try{
  const response=await fetch('/api/stores',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(Object.fromEntries(new FormData(form)))
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  document.querySelector('#store-admin').href=data.dashboard;
  document.querySelector('#store-catalog').href=data.storefront;
  document.querySelector('#store-created').hidden=false;
  form.reset();
  form.hidden=true;
  document.querySelector('#store-admin').focus();
 }catch(error){errorField.textContent=error.message;}
 finally{submit.disabled=false;}
};
