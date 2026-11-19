export function CurrentCatalogLink(){
  return <a className="shop-button" href="#/diy/collection" onClick={event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    // The catalog and price book are loaded together at application startup.
    window.location.hash=event.currentTarget.hash;
    window.location.reload();
  }}>查看当前在售款式</a>;
}
