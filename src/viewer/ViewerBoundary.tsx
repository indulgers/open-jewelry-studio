import {Component,type ReactNode} from 'react';
type Props={children:ReactNode;onRetry:()=>void;onError?:()=>void;errorDetail?:ReactNode};
export class ViewerBoundary extends Component<Props,{error:Error|null;attempt:number}>{
  state={error:null as Error|null,attempt:0};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(){this.props.onError?.();}
  render(){
    if(this.state.error)return <div className="viewer-message error-message" role="alert">
      <strong>暂时无法载入三维模型</strong>
      {this.props.errorDetail??<p>请检查连接后重试，当前配置不会丢失。</p>}
      <button onClick={()=>{this.props.onRetry();this.setState(s=>({error:null,attempt:s.attempt+1}));}}>重新加载模型</button>
    </div>;
    return <div className="viewer-boundary" key={this.state.attempt}>{this.props.children}</div>;
  }
}
