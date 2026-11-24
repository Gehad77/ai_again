import {formatMoney, language} from './i18n.js';

const sections={
 overview:[
  ['Overview','نظرة عامة'],
  ['Start here for a snapshot of sales, stock and conversations. Use the shortcuts to add a product or record an expense.','ابدئي هنا عشان تشوفي صورة سريعة للمبيعات والمخزون والمحادثات. من الأزرار تقدري تضيفي منتج أو تسجّلي مصروف.']
 ],
 products:[
  ['Products','المنتجات'],
  ['Set a selling price, unit cost and stock for each product. Include the materials and labour that go into one unit when you calculate its cost. Accurate costs let you compare what each product earns.','لكل منتج سجّلي سعر البيع وتكلفة القطعة والمخزون. احسبي الخامات والتصنيع اللي بتحتاجهم القطعة الواحدة ضمن تكلفتها. التكلفة الدقيقة بتساعدك تعرفي أي منتج بيكسب أكتر.']
 ],
 profile:[
  ['Business profile','ملف النشاط'],
  ['Use the warehouse to record stock movements and check the profit and loss report. Paid orders reduce stock. Write-offs reduce stock and count as a loss at the saved unit cost.','من المخزون سجّلي الحركات وراجعي تقرير الأرباح والخسائر. الطلب المدفوع بيخصم من المخزون. التالف بيقلّل المخزون وبيتسجّل كخسارة بتكلفة الوحدة المحفوظة.']
 ],
 expenses:[
  ['Expenses and targets','المصروفات والأهداف'],
  ['Record amounts you spend and link direct expenses to a product when useful. Mark amounts already included in product cost so they still show in spending but are not deducted twice. You can correct an entry in the expense list, download the period report for review, and track revenue and unit goals separately. For each product, set a monthly target or set a quarterly target to override the sum of its monthly goals.','سجّلي اللي صرفتيه واربطي المصروف المباشر بالمنتج لو مناسب. علّمي على أي مبلغ دخل بالفعل في تكلفة المنتج عشان يظهر في الصرف من غير خصمه مرتين. تقدري تصحّحي القيد من جدول المصروفات، وتنزّلي تقرير الفترة للمراجعة، وتتابعي هدف الإيراد وعدد القطع كل واحد لوحده. حددي لكل منتج هدف شهري، أو هدف ربع سنوي ياخد الأولوية على مجموع الأهداف الشهرية.']
 ],
 taxes:[
  ['Taxes','الضرائب'],
  ['Use this page to plan an income-tax reserve at a rate you supply. Record actual income-tax payments under Income tax in Expenses for the same period. Other business taxes can be tracked as separate expenses.','استخدمي الصفحة لعمل احتياطي لضريبة الدخل بالنسبة اللي تدخليها. سجّلي مدفوعات ضريبة الدخل الفعلية في المصروفات تحت تصنيف ضريبة الدخل للفترة نفسها. تقدري تسجّلي الضرائب التانية كمصروفات منفصلة.']
 ],
 analytics:[
  ['Sales analytics','تحليلات المبيعات'],
  ['Compare paid units, revenue and gross profit by product and channel. Use the period and channel filters to see what sells. Gross profit here is before operating expenses and tax.','قارني عدد القطع المدفوعة والإيراد وإجمالي الربح لكل منتج وقناة. حددي الفترة والقناة عشان تشوفي إيه اللي بيتباع. إجمالي الربح هنا قبل المصروفات التشغيلية والضريبة.']
 ],
 inbox:[
  ['Inbox','صندوق الرسائل'],
  ['Read messages from WhatsApp, Instagram, Messenger and the website in one place. Filter by channel and check conversation analysis to see what the customer is asking about.','اقري رسائل واتساب وإنستجرام وماسنجر والموقع في مكان واحد. اختاري القناة وراجعي تحليل المحادثة عشان تعرفي العميل بيسأل عن إيه.']
 ],
 customers:[
  ['Customers','العملاء'],
  ['Find people who signed up for website chat and review conversation history. Use this to look up an existing customer and understand what they previously asked about.','هنا تلاقي الناس اللي سجّلوا في شات الموقع وسجل المحادثات. هيساعدك ترجعي للعميل وتشوفي كان بيسأل عن إيه قبل كده.']
 ],
 insights:[
  ['Customer insights','تحليل العملاء'],
  ['Review buying intent, customer needs and common topics across analyzed chats. Use recurring questions to improve product descriptions, stock planning and customer responses.','راجعي نية الشراء واحتياجات العملاء والأسئلة المتكررة في المحادثات المتحللة. استخدميها لتحسين وصف المنتجات وتخطيط المخزون والردود.']
 ],
 integrations:[
  ['Social accounts','ربط السوشيال'],
  ['Find the webhook address and see which channels are receiving messages or have AI replies enabled. Test a message from a connected account to confirm that it appears in the inbox.','هنا تلاقي عنوان الـWebhook وحالة استقبال الرسائل والرد الآلي لكل قناة. ابعتي رسالة اختبار من حساب مربوط وتأكدي إنها ظهرت في الصندوق.']
 ],
 settings:[
  ['Settings','الإعدادات'],
  ['Choose the display language, currency, reporting time zone and low-stock threshold. Changing currency changes the label used for recorded amounts without converting their values.','اختاري اللغة والعملة وتوقيت التقارير وحد تنبيه المخزون. تغيير العملة بيغيّر العملة اللي بتظهر جنب الأرقام من غير تحويل قيمتها بسعر الصرف.']
 ]
};

const terms=[
 [['Sales revenue','إيراد المبيعات'],['Paid quantity × selling price. This is the money from recorded sales before deducting costs.','عدد القطع المدفوعة × سعر البيع. ده مبلغ المبيعات المسجّلة قبل خصم التكاليف.']],
 [['Cost of goods sold','تكلفة البضاعة المباعة'],['Paid quantity × recorded unit cost. Only the cost of units sold is deducted from sales.','عدد القطع المدفوعة × تكلفة الوحدة المسجّلة. اللي بيتخصم من المبيعات هنا هو تكلفة القطع اللي اتباعت.']],
 [['Gross profit','إجمالي الربح'],['Sales revenue minus the cost of goods sold. It shows what the products earned before operating expenses.','إيراد المبيعات ناقص تكلفة البضاعة المباعة. ده اللي المنتجات حققته قبل المصروفات التشغيلية.']],
 [['Operating expenses and write-offs','مصروفات التشغيل والتالف'],['Rent, marketing and shipping reduce the recorded result. Stock write-offs are valued at their unit cost. Costs already included in the product cost are not deducted again.','الإيجار والتسويق والشحن بيقلّلوا صافي النتيجة. التالف بيتحسب بتكلفة الوحدة. المصاريف اللي دخلت في تكلفة المنتج ما بتتخصمش مرة تانية.']],
 [['Net profit or loss','صافي الربح أو الخسارة'],['Gross profit minus separately deducted expenses and write-offs. Above zero means a profit. Below zero means a loss, and the amount below zero is how much you lost.','إجمالي الربح ناقص المصروفات اللي بتتخصم منفصلة والتالف. الرقم فوق الصفر مكسب، وتحت الصفر خسارة، والفرق عن الصفر هو قيمة الخسارة.']],
 [['Profit margin','هامش الربح'],['Profit ÷ sales revenue × 100. It tells you how much of each 100 in sales stays as profit. The report shows no margin when revenue is zero.','الربح ÷ إيراد المبيعات × ١٠٠. النسبة بتقولك كام من كل ١٠٠ مبيعات بيبقى ربح. لو الإيراد صفر مش هيظهر هامش.']],
 [['Break-even and profit target','نقطة التعادل وهدف الربح'],['Subtract unit cost from selling price to get the amount one sale contributes to expenses. Divide the expenses to cover by that amount and round up to whole units. Break-even covers costs. A sale beyond exact break-even starts generating profit.','اطرحي تكلفة القطعة من سعرها عشان تعرفي كام بيتبقى منها لتغطية المصاريف. اقسمي المصاريف على الرقم ده وقرّبي لأعلى لعدد قطع صحيح. نقطة التعادل بتغطي التكلفة، والبيع بعد التعادل الدقيق يبدأ يحقق ربح.']],
 [['Revenue and unit targets','هدف الإيراد وهدف القطع'],['The dashboard subtracts paid sales and units sold from the matching goals. It estimates extra units for a revenue gap using the selected product price or the recorded average price.','الداشبورد بيطرح المبيعات المدفوعة وعدد القطع المباعة من كل هدف. وبيقدّر عدد القطع المطلوبة لتعويض فرق الإيراد باستخدام سعر المنتج المختار أو متوسط السعر المسجّل.']],
 [['Pricing for a target margin','التسعير بهامش ربح مستهدف'],['Suggested price = total unit cost ÷ (1 − target margin as a decimal). A 20% margin on a unit costing 100 gives a price of 125. The difference covers operating expenses first and can become profit after those expenses.','السعر المقترح = إجمالي تكلفة القطعة ÷ (١ ناقص الهامش كنسبة عشرية). لو التكلفة ١٠٠ وعايزة هامش ٢٠٪، السعر يبقى ١٢٥. الفرق بيساعد يغطي مصاريف التشغيل الأول، واللي يتبقى بعدها يبقى ربح.']],
 [['Inventory value','قيمة المخزون'],['Inventory value at cost is available units × saved unit cost. Retail inventory value uses the selling price instead. Both measure stock still available.','قيمة المخزون بالتكلفة = القطع المتاحة × تكلفة الوحدة المحفوظة. وقيمة المخزون بسعر البيع بتستخدم سعر البيع بدل التكلفة. الاتنين بيقيسوا المخزون اللي لسه موجود.']],
 [['Average order value','متوسط قيمة الطلب'],['Paid sales revenue ÷ number of paid orders. Use it to compare how much customers spend per order in different periods or channels.','إيراد المبيعات المدفوعة ÷ عدد الطلبات المدفوعة. بيساعدك تقارني متوسط طلب العميل بين الفترات أو القنوات.']],
 [['Income tax and VAT','ضريبة الدخل والقيمة المضافة'],['The planner uses your rate on positive pre-tax profit and subtracts income-tax payments recorded for the period from the reserve. VAT and sales tax have separate rules, so this planner does not estimate them.','المخطط بيطبّق النسبة اللي دخلتيها على الربح الموجب قبل الضريبة، وبيخصم المدفوع المسجّل لنفس الفترة من الاحتياطي. القيمة المضافة وضريبة المبيعات ليهم حسابات مختلفة، والمخطط ده مخصص لضريبة الدخل.']]
];

const pick=pair=>pair[language==='ar'?1:0];

export function contextGuide(page){
 const section=sections[page];
 if(!section)return '';
 return `<details class="context-guide"><summary>${pick(['How to use this section','إزاي تستخدمي القسم ده؟'])}</summary>
 <p>${pick(section[1])}</p><button type="button" data-go="guide">${pick(['Open the full business guide','افتحي دليل النشاط بالكامل'])}</button></details>`;
}

export function guidePage(){
 const money=n=>`<bdi>${formatMoney(n)}</bdi>`;
 const example=pick([
  `If sales are ${money(1000)} and product costs are ${money(600)}, gross profit is ${money(400)}. With ${money(150)} in other expenses, pre-tax profit is ${money(250)}. At a planning rate of 20%, the tax estimate is ${money(50)}. If ${money(15)} was recorded as paid for the same period, reserve another ${money(35)}. Estimated profit after tax is ${money(200)}.`,
  `لو المبيعات ${money(1000)} وتكلفة البضاعة ${money(600)}، إجمالي الربح ${money(400)}. بعد مصروفات ${money(150)}، الربح قبل الضريبة ${money(250)}. على نسبة تقديرية ٢٠٪، الضريبة ${money(50)}. لو سجلتي ${money(15)} مدفوعة لنفس الفترة، الاحتياطي المتبقي ${money(35)}، والربح بعد تقدير الضريبة ${money(200)}.`
 ]);
 return `<div class="heading"><h1>${pick(['Business guide','دليل النشاط'])}</h1><p>${pick(['Learn how to use each section and read your numbers.','اعرفي كل قسم بيتستخدم إزاي واقري أرقام نشاطك بسهولة.'])}</p></div>
 <div class="page-actions"><button class="primary" data-section="guide-calculations">${pick(['Understand the calculations','افهمي الحسابات'])}</button>
 <button data-section="guide-sections">${pick(['Explore dashboard sections','تعرّفي على الأقسام'])}</button></div>
 <section class="card recent guide-section" id="guide-calculations"><h2>${pick(['Understand the calculations','افهمي الحسابات'])}</h2>
 ${terms.map(([name,body])=>`<details><summary>${pick(name)}</summary><p>${pick(body)}</p></details>`).join('')}
 <div class="notice"><h3>${pick(['Worked example','مثال بالأرقام'])}</h3><p>${example}</p></div></section>
 <section class="card recent guide-section" id="guide-sections"><h2>${pick(['Explore dashboard sections','تعرّفي على الأقسام'])}</h2>
 <div class="guide-grid">${Object.entries(sections).map(([page,[title,body]])=>`<article><h3>${pick(title)}</h3><p>${pick(body)}</p>
 <button type="button" data-go="${page}">${pick(['Open section ↗','افتحي القسم ↗'])}</button></article>`).join('')}</div></section>`;
}
