import{n as e}from"./chunk-DseTPa7n.js";import{D as t,ft as n,k as r,l as i,m as a,r as o,s,u as c,ut as l}from"./runtime-core.esm-bundler-WGAHmYzY.js";import{a as u,g as d}from"./app-Birlln-4.js";function f(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function p(e={}){let t=Number(e?.paper_size??80),n=[`mm`,`cm`,`in`,`pt`,`pc`,`px`],r=String(e?.paper_size_unit??`mm`).trim().toLowerCase();return`${Number.isFinite(t)&&t>0?t:80}${n.includes(r)?r:`mm`}`}function m(e,t){let n=Number(e);return!Number.isFinite(n)||n<=0?t:n}function h(){return typeof navigator>`u`?!1:/android/i.test(navigator.userAgent||``)}function g(){return typeof navigator>`u`?!1:/iphone|ipad|ipod/i.test(navigator.userAgent||``)}function _(e={}){return y(e)===`rawbt`}function v(e={}){return y(e)===`airprint`}function y(e={}){let t=String(e?.printer_name??``).trim().toLowerCase();return g()&&(!t||t===`browser`||t===`default`||t===`auto`||t===`rawbt`||t===`cefsharp`)?`airprint`:h()&&t===`airprint`?`browser`:t||`browser`}function b(e){let t=String(e??``).trim();if(!t)return!1;let n=`intent:${encodeURIComponent(t)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;return window.location.href=n,!0}function x({orderRef:e=``,items:t=[],setting:n={}}={}){let r=t.length?t.map(e=>`
          <tr>
            <td class="check-col">&#9633;</td>
            <td class="qty-col">${Number(e?.quantity??0)||0}</td>
            <td class="name-col">${f(e?.name??`Unnamed item`)}</td>
          </tr>
        `).join(``):`
      <tr>
        <td class="empty" colspan="3">No items</td>
      </tr>
    `,i=e?`Order #${f(e)}`:`Order`,a=p(n),o=m(n?.store_name_font_size,14),s=m(n?.main_font_size,10);return`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${i}</title>
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: "Courier New", Courier, monospace;
            color: #000;
            padding: 12px;
            font-size: ${s}pt;
          }

          .receipt {
            width: ${a};
            max-width: 100%;
          }

          h1 {
            margin: 0 0 10px;
            font-size: ${o}pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${s}pt;
          }

          th,
          td {
            padding: 4px 0;
            vertical-align: top;
          }

          thead th {
            border-bottom: 1px dashed #000;
            font-weight: 700;
            text-align: left;
          }

          .check-col {
            width: 18px;
            font-size: 14px;
          }

          .qty-col {
            width: 36px;
            text-align: center;
          }

          .name-col {
            width: auto;
            word-break: break-word;
          }

          .empty {
            text-align: center;
            padding-top: 8px;
          }

          @media print {
            body {
              padding: 0;
            }

            .receipt {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>${i}</h1>
          <table>
            <thead>
              <tr>
                <th class="check-col"> </th>
                <th class="qty-col">Qty</th>
                <th class="name-col">Item</th>
              </tr>
            </thead>
            <tbody>
              ${r}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `}function S(e={}){let t=x(e);if(window.CefSharp){window.CefSharp.PostMessage(t);return}if(_(e?.setting)&&b(t))return;if(v(e?.setting)){let e=window.open(``,`_blank`,`width=420,height=780`);if(!e){window.print();return}e.document.open(),e.document.write(t),e.document.close(),e.focus(),setTimeout(()=>{e.print(),e.close()},200);return}let n=window.open(``,`_blank`,`width=420,height=780`);if(!n){window.print();return}n.document.open(),n.document.write(t),n.document.close(),n.focus(),setTimeout(()=>{n.print(),n.close()},200)}var C=e({default:()=>H}),w={class:`bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden`},T={class:`flex items-center gap-2`},E={class:`relative flex h-2 w-2`},D={class:`divide-y divide-gray-100`},O={class:`flex items-start gap-4`},k={class:`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-indigo-100 text-indigo-700 font-bold`},A={class:`text-lg font-bold text-slate-800 leading-tight`},j={class:`text-sm text-slate-500`},M={class:`text-gray-600 font-semibold`},N={key:0},P=[`id`,`name`,`checked`,`onChange`],F=[`for`],I={key:0,class:`text-center text-sm text-gray-400 py-4`},L={class:`px-6 pb-2 flex gap-2`},R={key:0},z={key:1},B={key:2},V={class:`px-6 pb-6 flex gap-2`},H={__name:`OrderCard`,props:{type:String,status:String,order:Object},setup(e){let f=e,p=u().props.setting??{};function m(e){return(e?.menuVariation??e?.menu_variation)?.menu?.name??e?.product?.name??e?.item_name??e?.name??`Unnamed item`}function h(e){return(e?.menuVariation??e?.menu_variation)?.name??e?.variation_name??`—`}function g(e){return e?.order?.items??e?.items??[]}function _(e){return String(e?.order?.order_id??e?.order_id??e?.id??``).replace(/^ORD-/,``)}function v(e){return!!(e?.is_cooked??e?.isCooked??!1)}function y(e,t){d.patch(route(`admin.kitchen.items.update`,[f.order.id,e.id]),{is_cooked:t.target.checked},{preserveScroll:!0,preserveState:!0})}function b(e){d.patch(route(`admin.kitchen.update`,f.order.id),{status:e},{preserveScroll:!0,preserveState:!0})}function x(){let e=f.order?.order?.id,t=f.order?.order?.status??`Pending`;e&&d.patch(route(`admin.orders.update`,e),{status:t,send_to_kitchen:!1},{preserveScroll:!0,preserveState:!0})}function C(){b(`cooking`)}function H(){b(`serving`)}function U(){b(`completed`)}function W(){b(`pending`)}function G(){b(`cooking`)}function K(){b(`serving`)}function q(){S({orderRef:_(f.order),setting:p,items:g(f.order).map(e=>({quantity:e?.quantity??0,name:m(e)}))})}return(u,d)=>(t(),c(`div`,w,[s(`div`,{class:l([f.type==`queue`?`bg-amber-50 border-amber-100`:f.type==`cooking`?`bg-indigo-50 border-indigo-100`:`bg-emerald-50 border-emerald-100`,`px-6 py-2 flex justify-between items-center border-b`])},[s(`span`,{class:l([f.type==`queue`?`text-amber-700`:f.type==`cooking`?`text-indigo-700`:`text-emerald-700`,`text-xs font-bold uppercase tracking-wider`])},`Order #`+n(_(e.order)),3),s(`div`,T,[s(`span`,E,[s(`span`,{class:l([f.type==`queue`?`bg-amber-400`:f.type==`cooking`?`bg-indigo-400`:`bg-emerald-400`,`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75`])},null,2),s(`span`,{class:l([f.type==`queue`?`bg-amber-500`:f.type==`cooking`?`bg-indigo-500`:`bg-emerald-500`,`relative inline-flex rounded-full h-2 w-2`])},null,2)]),s(`span`,{class:l([f.type==`queue`?`text-amber-800`:f.type==`cooking`?`text-indigo-800`:`text-emerald-800`,`text-sm font-semibold`])},n(f.status),3)])],2),s(`div`,{class:l([f.status==`complete`?`max-h-[55vh]`:`max-h-[80vh]`,`p-6 overflow-auto`])},[s(`ul`,D,[(t(!0),c(o,null,r(g(e.order),e=>(t(),c(`li`,{key:e.id,class:`flex justify-between hover:shadow-lg hover:-translate-y-0.5 duration-300 p-2 px-4`},[s(`div`,O,[s(`span`,k,n(e.quantity),1),s(`div`,null,[s(`p`,A,n(m(e)),1),s(`p`,j,[d[5]||=a(`Variation: `,-1),s(`span`,M,n(h(e)),1)])])]),f.type==`cooking`?(t(),c(`div`,N,[s(`input`,{type:`checkbox`,id:`item-${e.id}`,name:`item-${e.id}`,checked:v(e),onChange:t=>y(e,t),class:`w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-1 cursor-pointer`},null,40,P),s(`label`,{for:`item-${e.id}`,class:`ml-1 text-sm font-medium text-gray-900 cursor-pointer select-none`},`Cooked`,8,F)])):i(``,!0)]))),128)),g(e.order).length?i(``,!0):(t(),c(`li`,I,`No items.`))])],2),s(`div`,L,[f.status==`complete`?i(``,!0):(t(),c(`button`,{key:0,class:`flex-1 rounded-lg bg-slate-100 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 transition`,onClick:q},`Print`)),f.status==`complete`?i(``,!0):(t(),c(`button`,{key:1,class:l([f.type==`queue`?`bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-200`:f.type==`cooking`?`bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200`:`bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200`,`flex-[2] rounded-lg py-2 text-sm font-bold text-white transition`]),onClick:d[0]||=e=>f.type==`queue`?C():f.type==`cooking`?H():U()},[f.type==`queue`?(t(),c(`p`,R,`Start Cooking`)):f.type==`cooking`?(t(),c(`p`,z,`Move to Serving`)):(t(),c(`p`,B,`Complete Order`))],2))]),s(`div`,V,[f.type==`queue`?(t(),c(`button`,{key:0,class:`flex-1 rounded-lg bg-rose-50 py-2 text-sm font-bold text-rose-700 border border-rose-200 hover:bg-rose-100 transition`,onClick:d[1]||=e=>x()},` Remove from Queue `)):f.type==`cooking`?(t(),c(`button`,{key:1,class:`flex-1 rounded-lg bg-amber-50 py-2 text-sm font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition`,onClick:d[2]||=e=>W()},` Return to Queue `)):f.type==`serving`?(t(),c(`button`,{key:2,class:`flex-1 rounded-lg bg-indigo-50 py-2 text-sm font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition`,onClick:d[3]||=e=>G()},` Return to Cooking `)):f.status==`complete`?(t(),c(`button`,{key:3,class:`flex-1 rounded-lg bg-emerald-50 py-2 text-sm font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition`,onClick:d[4]||=e=>K()},` Return to Serving `)):i(``,!0)])]))}};export{H as n,C as t};