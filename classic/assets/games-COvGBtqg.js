class n{constructor(){this.canvas=null,this.ctx=null,this.active=!1}init(){const t=document.getElementById("restaurador-game-container");t&&(t.textContent="",t.insertAdjacentHTML("afterbegin",`
      <div class="restaurador-wrapper">
        <div class="game-header">
          <h2>👨‍🎨 El Restaurador Desastroso</h2>
        </div>
        <canvas id="restaurador-canvas" width="600" height="500"></canvas>
        <div class="controls">
             <button id="restaurar-btn">RESTAURAR (ARRASTRAR)</button>
             <button id="mint-btn">INMORTALIZAR (NFT)</button>
        </div>
      </div>
    `),this.canvas=document.getElementById("restaurador-canvas"),this.ctx=this.canvas.getContext("2d"),this.canvas.addEventListener("mousemove",e=>{if(e.buttons!==1)return;const a=this.canvas.getBoundingClientRect(),s=e.clientX-a.left,i=e.clientY-a.top;this.ctx.fillStyle="#8B4513",this.ctx.beginPath(),this.ctx.arc(s,i,10,0,Math.PI*2),this.ctx.fill()}),t.querySelector("#mint-btn").addEventListener("click",()=>{window.RestauradorWeb3?window.RestauradorWeb3.mintNFT(this.canvas.toDataURL()):alert("Sistema Web3 no detectado.")}),this.drawBase())}drawBase(){this.ctx.fillStyle="#DDD",this.ctx.fillRect(0,0,600,500),this.ctx.fillStyle="#000",this.ctx.font="80px serif",this.ctx.textAlign="center",this.ctx.fillText("🖼️",300,250),this.ctx.font="20px serif",this.ctx.fillText("Pintura Inestimable",300,300)}}window.RestauradorGame=new n;
