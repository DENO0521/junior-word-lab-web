(function(root,factory){const paper=factory();if(typeof module==='object'&&module.exports)module.exports=paper;root.WORD_LAB_SAMPLE=paper;})(globalThis,function(){
 const q=(id,wordIds,prompt,options,answer,explanation,blankNumber=null)=>({id,wordIds,prompt,options,answer,explanation,blankNumber});
 return {title:'校园生活 · 原创中考风格示例卷',source:'original-demo',wordIds:Array.from({length:20},(_,i)=>i+1),sections:[
  {id:'demo-single',type:'single',title:'一、单项选择（原创示例）',passage:'',questions:[
   q('demo-s1',[1],'—Will you _____ my invitation to the school concert? —Yes, I would love to come.',['accept','avoid','break','build'],'accept','回答表示愿意参加，所以用 accept，意为“接受（邀请）”。'),
   q('demo-s2',[2],'If we practise a little every day, we can _____ our goal of reading ten English books.',['borrow','achieve','bring','attend'],'achieve','achieve our goal 表示“实现我们的目标”。'),
   q('demo-s3',[3],'The soup is not salty enough. Please _____ a little salt to it.',['answer','allow','add','ask'],'add','add ... to ... 表示“把……加入……”。'),
   q('demo-s4',[4],'—I keep forgetting new words. —I _____ you to review them for ten minutes each day.',['agree','afford','avoid','advise'],'advise','advise somebody to do something 表示“建议某人做某事”。'),
   q('demo-s5',[5],'The bike costs too much. I cannot _____ it with the money I have now.',['afford','accept','attend','achieve'],'afford','结合价格太高和钱不够可知，cannot afford it 表示“买不起”。')
  ]},
  {id:'demo-cloze',type:'cloze',title:'二、完形填空：Our Class Reading Corner',passage:`Our class wanted a quiet place to read during lunch. We had an empty corner, but no books or chairs. At first, not everyone liked the idea. Some students wanted more space for games. We talked together and finally [1] to try a reading corner for one month.
Our teacher would [2] us to use the corner if we kept it clean. Before we started, we had to [3] one important question: where could we get books? We decided to [4] the school librarian for help. She said we could [5] books from the library for two weeks. We also wrote simple rules to [6] noise and keep the books safe.
On Friday, everyone helped. Some students would [7] cushions from home. Others used old boxes to [8] a small shelf. After lunch on Monday, the corner was full of happy readers. Working together had made a small idea real.`,questions:[
   q('demo-c1',[6],'第 [1] 空',['agreed','broke','borrowed','answered'],'agreed','前文有不同意见，讨论之后达成一致，agree to do something 表示“同意做某事”。',1),
   q('demo-c2',[7],'第 [2] 空',['achieve','avoid','allow','attend'],'allow','allow somebody to do something 表示“允许某人做某事”。',2),
   q('demo-c3',[8],'第 [3] 空',['bring','answer','build','accept'],'answer','后面是 an important question，answer a question 表示“回答一个问题”。',3),
   q('demo-c4',[9],'第 [4] 空',['break','become','afford','ask'],'ask','ask somebody for help 表示“向某人寻求帮助”。',4),
   q('demo-c5',[17],'第 [5] 空',['borrow','beat','add','advise'],'borrow','图书馆的书借两周后归还，所以用 borrow。',5),
   q('demo-c6',[10],'第 [6] 空',['begin','believe','avoid','agree'],'avoid','阅读角需要安静，制定规则是为了 avoid noise，避免噪声。',6),
   q('demo-c7',[19],'第 [7] 空',['accept','bring','achieve','answer'],'bring','从家里把靠垫带到阅读角，bring 表示“带来”。',7),
   q('demo-c8',[20],'第 [8] 空',['ask','attend','allow','build'],'build','用旧盒子搭建书架，build 表示“建造”。',8)
  ]},
  {id:'demo-reading',type:'reading',title:'三、阅读理解：A Different Kind of School Club',passage:`When Mei decided to attend the school garden club, she thought it would be easy. She liked flowers and wanted to become a better gardener. At the first meeting, however, the club leader asked everyone to begin with a small box of soil. There were no flowers yet.
“Plants need time,” he said. “We must be patient. A garden is not a race. You do not need to beat anyone.” Mei did not believe that a few tiny seeds could fill the empty box with colour, but she agreed to try.
Every Tuesday, the students checked the soil and watered their plants. They took a short break after working and wrote notes about any changes. One week, Mei's plant looked weak. She wanted to throw it away. Her friend told her to move it closer to the window instead.
Two weeks later, new green leaves appeared. By the end of the term, Mei had a healthy plant and a notebook full of pictures. She had learned something beyond gardening: when a plan does not work at once, a small change and a little more time may help.`,questions:[
   q('demo-r1',[],'Why did Mei join the garden club?',['To win a race against other students.','To learn to take better care of plants.','To sell flowers at the school gate.','To help her friend write a notebook.'],'To learn to take better care of plants.','第一段说她想 become a better gardener，即提高种植能力。'),
   q('demo-r2',[],'What did the students do at their first meeting?',['They bought flowers for their classroom.','They took pictures of a healthy plant.','They started with a small box of soil.','They moved all plants outside.'],'They started with a small box of soil.','第一段明确说明大家从一小盒土开始，当时还没有花。'),
   q('demo-r3',[],'What helped Mei’s weak plant grow new leaves?',['Giving it no water for two weeks.','Throwing it away after a short break.','Putting it into a bigger notebook.','Moving it closer to the window.'],'Moving it closer to the window.','第三段朋友建议把植物移到更靠近窗户的地方，之后长出了新叶。'),
   q('demo-r4',[],'What can we learn about Mei by the end of the story?',['She became more patient with a difficult task.','She decided never to try a new club again.','She thought winning was the only important thing.','She stopped checking her plant every week.'],'She became more patient with a difficult task.','结合最后一段，她学会给计划更多时间并作适当调整，可推断她更加耐心。'),
   q('demo-r5',[],'What is the main idea of the passage?',['School gardens should only have flowers.','A notebook can make plants grow faster.','Small changes and patience can help us learn.','Students must always work without a break.'],'Small changes and patience can help us learn.','文章由种植经历引出最后的学习体会：适当调整并耐心等待有助于成长。')
  ]}
 ]};
});
