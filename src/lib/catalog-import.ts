import type { NewCatalogItemInput } from "@/types/billing";

// RFC-style quoted CSV, including escaped quotes and multiline descriptions.
export function parseCatalogCsv(text: string): NewCatalogItemInput[] {
  const rows: string[][]=[]; let row:string[]=[]; let field=""; let quoted=false; let closed=false;
  text=text.replace(/^\uFEFF/, "");
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(quoted) {
      if(char==='"') {if(text[i+1]==='"'){field+='"';i++;}else {quoted=false;closed=true;}}
      else field+=char;
    } else if(char===',' || char==='\n' || char==='\r') {
      row.push(field.trim()); field=""; closed=false;
      if(char!==',') {if(row.some(value=>value!==""))rows.push(row);row=[];if(char==='\r' && text[i+1]==='\n')i++;}
    } else if(char==='"') {
      if(field.trim() || closed)throw new Error("CSV contains an unexpected quote."); quoted=true;
    } else {
      if(closed && char.trim()) throw new Error("CSV contains text after a closing quote.");
      field+=char;
    }
  }
  if(quoted)throw new Error("CSV has an unclosed quoted field.");
  row.push(field.trim());if(row.some(value=>value!==""))rows.push(row);
  if(rows.length<2)throw new Error("CSV must contain headers and at least one item.");
  const headers=rows.shift()!.map(value=>value.toLowerCase());
  const supported=['title','category','sku','price','currency','unit','description'];
  if(new Set(headers).size!==headers.length || ['title','category','sku','price'].some(name=>!headers.includes(name)) || headers.some(name=>!supported.includes(name)))throw new Error("Use unique title, category, sku and price headers; optional headers are currency, unit and description.");
  if(rows.length>5000)throw new Error("Import at most 5,000 items at once.");
  return rows.map((values,index)=>{
    if(values.length!==headers.length)throw new Error(`CSV row ${index+2} has the wrong number of columns.`);
    const value=Object.fromEntries(headers.map((header,i)=>[header,values[i]]));
    return {title:value.title,category:value.category as NewCatalogItemInput['category'],sku:value.sku,price:value.price,currency:(value.currency||'LKR') as NewCatalogItemInput['currency'],unit:value.unit||'/ Hourly',description:value.description||''};
  });
}
