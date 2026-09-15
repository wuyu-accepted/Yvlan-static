import type { ForumWorldRuntimeEvidence } from './forumWorldRuntime.ts'

// UI-only conversation examples. Never included in runtime records or statistics.
const conversations = {
  gym: [
    ['A','刚刷到那个帖子。我上次也没约上，但没去现场看。','Just saw the post. I could not book last time either, but I did not check the courts.'],
    ['B','我想约羽毛球。空着和能不能约到底是不是一回事？','I want a badminton slot. Does an empty court necessarily mean it is bookable?'],
    ['C','会不会有人约了没来？我瞎猜的，别拿我这句去转。','Could someone have booked and not shown up? Just guessing — do not quote me on that.'],
    ['A','反正一直点不开挺烦的，换个时间大家又凑不齐。','It is frustrating to keep finding nothing available. We cannot all make another time.'],
    ['B','先问取消的场地啥时候放出来吧，这个对我最有用。','Let us ask when cancelled slots become available. That would actually help me.'],
    ['C','行，你问预约，我问现场；有答复了再对一下。','Okay, you ask about bookings and I will ask at the venue. We can compare replies.'],
  ],
  housing: [
    ['A','床位那帖你们看了吗，我读了两遍还是没弄懂怎么排。','Did you see the housing post? I read it twice and still do not understand the ranking.'],
    ['B','我先关心有没有地方住，天天刷页面有点绷不住。','I just need somewhere to stay. Constantly refreshing the page is getting to me.'],
    ['C','群里有人说看提交时间，那个有出处吗？','Someone said it depends on submission time. Is there a source for that?'],
    ['A','我也只是看到有人这么说，不敢确定。','I only saw someone say that too. I cannot confirm it.'],
    ['B','能查到自己卡在哪一步就好了，不然补啥都不知道。','I wish I could see which step my application is stuck at. I do not know what to fix.'],
    ['C','先把“怎么排”和“我这份怎么办”分开问，别一股脑吵。','Let us ask about the ranking and our applications separately. We are talking past each other.'],
  ],
  lecture: [
    ['A','看到讲座那帖了，光看描述就挺生气的。','I saw the lecture post. Even the description made me angry.'],
    ['B','我没在现场，但学生为啥得受这种气啊。','I was not there, but why should students have to put up with that?'],
    ['C','我想知道主办方后面怎么处理，只说关注了可不够。','I want to know what the organisers will do. Just saying they are aware is not enough.'],
    ['A','对，我关心的也是这事有没有人负责。','Exactly. I want to know who is taking responsibility.'],
    ['B','新回复太多了，有后续喊我，我先不往别的群转。','There are so many replies. Let me know if there is an update; I will hold off forwarding it.'],
    ['C','行，看到正式回应我们再一起看看说了啥。','Sure. If a response comes out, we can read it together.'],
  ],
  generic: [
    ['A','刚看到论坛那个帖子，你们怎么看？','I just saw that forum post. What do you think?'],
    ['B','有点在意，但我还没看完回复。','It caught my attention, but I have not finished reading the replies.'],
    ['C','我也在看，大家好像关心的点不一样。','Same here. People seem to care about different parts of it.'],
    ['A','对我来说，能不能说清楚接下来怎么办更重要。','For me, what matters is knowing what happens next.'],
    ['B','我先把自己的问题列一下，免得问半天没问到点上。','I will write down my questions so I do not miss what matters to me.'],
    ['C','你列完发这里，我们帮你看看。','Send them here when you are done. We can take a look.'],
  ],
} as const

export function examplePrivateDialogue(scenario: string, group: boolean, english: boolean, id: string): ForumWorldRuntimeEvidence[] {
  const key = /legitimacy|housing|dormitory/.test(scenario) ? 'housing'
    : /lecture/.test(scenario) ? 'lecture' : /gym/.test(scenario) ? 'gym' : 'generic'
  return conversations[key].filter(row => group || row[0] !== 'C').map((row, index) => ({
    id:`ui-example:${id}:${index}`,
    kicker:english ? 'Conversation example' : '示例对话',
    speaker:english ? `${group ? 'Member' : 'Friend'} ${row[0]}` : `${group ? '群友' : '好友'} ${row[0]}`,
    align:row[0] === 'B' ? 'right' : 'left',
    text:row[english ? 2 : 1],
    provenance:'ui_example',
  }))
}
