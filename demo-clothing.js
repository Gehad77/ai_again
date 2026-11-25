import {businessDate} from './public/business-model.js';

const styles=[
 {name:'هودي أوفر سايز',category:'هودي',price:890,cost:480,colors:['أسود','رمادي','زيتي'],sizes:['S','M','L','XL'],description:'خامة قطن مبطن من الداخل، قصّة واسعة بغطاء رأس وجيب أمامي. مناسب للجو البارد.'},
 {name:'تيشرت قطن بيسك',category:'تيشرت',price:360,cost:175,colors:['أبيض','أسود','بيج'],sizes:['S','M','L','XL'],description:'قطن 100%، قصّة عادية ورقبة دائرية. خفيف ومناسب للاستخدام اليومي. المقاس مطابق للمقاس المعتاد.'},
 {name:'بنطلون كارغو',category:'بنطلون',price:740,cost:390,colors:['أسود','بيج','زيتي'],sizes:['M','L','XL'],description:'توِيل قطني بقصّة مستقيمة، جيوب جانبية وحزام قابل للتعديل. مناسب للخروج اليومي.'}
];

const policies=`ده متجر ملابس تجريبي. الأسعار بالجنيه المصري. كل لون ومقاس له سجل مخزون مستقل في الكتالوج، فلو العميل ماحددش المقاس أو اللون اسأله قبل تأكيد التوفر.
الشحن التجريبي للقاهرة والجيزة 60 جنيه خلال 2–3 أيام عمل، وباقي المحافظات 90 جنيه خلال 3–5 أيام عمل. الدفع عند الاستلام متاح في سيناريو التجربة.
الاستبدال أو الاسترجاع خلال 14 يوم من الاستلام بشرط إن القطعة تفضل بحالتها وبالتاج. الطلبات للتجربة فقط ومش بيتم شحنها فعليًا.`;

export const demoClothingSlug='men-el-chat-demo';

export async function loadClothingDemo(client,recordSale){
 const today=businessDate();
 const month=today.slice(0,7);
 const quarter=today.slice(0,4)+'-Q'+Math.ceil(Number(today.slice(5,7))/3);

 for(const style of styles){
  for(const [colorIndex,color] of style.colors.entries()){
   for(const [sizeIndex,size] of style.sizes.entries()){
    const stock=[7,14,20,5][sizeIndex]+colorIndex;
    const {rows:[product]}=await client.query(`
     INSERT INTO products(id,name,category,price,unit_cost,stock,emoji,color,desired_stock,public_description)
     VALUES(nextval('product_ids'),$1,$2,$3,$4,$5,'◇','#e5eee6',20,$6) RETURNING *
    `,[`${style.name} - ${color} - ${size}`,style.category,style.price,style.cost,stock,
       `${style.description} اللون: ${color}. المقاس: ${size}.`]);
    await client.query(`INSERT INTO stock_movements(product_id,delta,stock_after,kind,unit_cost)
     VALUES($1,$2,$2,'opening',$3)`,[product.id,stock,style.cost]);
    await client.query('INSERT INTO product_targets(product_id,period,units) VALUES($1,$2,$3),($1,$4,$5)',
     [product.id,month,5,quarter,15]);
    if(colorIndex===0&&sizeIndex===1){
     const {rows:[order]}=await client.query(`
      INSERT INTO orders(id,product_id,quantity,unit_price,unit_cost,channel,status,date,paid_at)
      VALUES(nextval('order_ids'),$1,2,$2,$3,'Website','Paid',NOW(),NOW()) RETURNING *
     `,[product.id,style.price,style.cost]);
     await recordSale(client,order,product);
    }
   }
  }
 }
 await client.query('INSERT INTO sales_targets(period,amount,units) VALUES($1,120000,165),($2,360000,495)',[month,quarter]);
 await client.query(`INSERT INTO operating_expenses(description,amount,date,category) VALUES
  ('حملة إطلاق تجريبية',2400,$1,'Marketing'),
  ('تغليف الطلبات',480,$1,'Packaging'),
  ('مصاريف توصيل',360,$1,'Shipping'),
  ('اشتراك أدوات المتجر',550,$1,'Tools & subscriptions')`,[today]);
 await client.query("UPDATE workspace_settings SET currency='EGP',language='ar',assistant_notes=$1 WHERE id=1",[policies]);
}
