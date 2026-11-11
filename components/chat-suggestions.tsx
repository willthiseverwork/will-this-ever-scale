import {chatSuggestions,keepSuggestion} from '../lib/chat-suggestions';
export default function ChatSuggestions({item,onAsk}:{item?:string;onAsk:(question:string)=>void}){
 return <div className="chat-suggestions" aria-label="Suggested questions">{chatSuggestions.map(p=><button key={p.question} data-analytics-id="chat_suggestion" onClick={()=>onAsk(p.question)}>{p.label}</button>)}{item&&<button className="chat-keep-chip" data-analytics-id="chat_chip_keep" onClick={()=>onAsk(keepSuggestion(item).question)}>{keepSuggestion(item).label}</button>}</div>;
}
