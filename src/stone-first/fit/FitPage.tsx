import {FitProfileForm} from './FitProfileForm';
import {NecklaceGuide,RingGuide} from './FitGuide';
import './fit.css';

export default function FitPage(){
  return <main className="fit-page">
    <nav aria-label="所在页面"><a href="#/diy/collection">款式系列</a> / 佩戴资料</nav>
    <h1>我的佩戴资料</h1>
    <FitProfileForm/>
    <div className="fit-guides"><RingGuide/><NecklaceGuide/></div>
    <a className="fit-link" href="#/diy/collection">选择款式</a>
  </main>;
}
