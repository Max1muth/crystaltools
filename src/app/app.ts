import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('mainCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private main_canvas!: HTMLCanvasElement;
  private main_ctx!: CanvasRenderingContext2D;
  private ext_layer!: HTMLCanvasElement;
  private ext_ctx!: CanvasRenderingContext2D;

  private dpr = window.devicePixelRatio || 1;

  public angle = 0;
  public zoom = 1;
  public offsetX = 0;
  public offsetY = 0;
  private lastMousePos = { x: 0, y: 0 };

  public mode: 'simple' | 'extrapolation' | 'move' = 'extrapolation';
  private lastDrawMode: 'simple' | 'extrapolation' = 'extrapolation';
  public ext_buffer: { x: number, y: number }[] = [];
  public brushColor: string = '#ff0000';
  private isDrawing = false;

  public bgImageObj: HTMLImageElement = new Image();
  public isBgLoaded = false;

  public history: string[] = []; 
  private maxHistory = 30;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = 800 * this.dpr;
    canvas.height = 600 * this.dpr;
    
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.scale(this.dpr, this.dpr);

    this.main_canvas = this.createLayer();
    this.main_ctx = this.main_canvas.getContext('2d')!;
    this.main_ctx.scale(this.dpr, this.dpr);

    this.ext_layer = this.createLayer();
    this.ext_ctx = this.ext_layer.getContext('2d')!;
    this.ext_ctx.scale(this.dpr, this.dpr);

    this.loadDefaultBackground();
    this.initMainCanvas();
    this.render();
  }

  private loadDefaultBackground() {
    this.bgImageObj.onload = () => { this.isBgLoaded = true; };
    this.bgImageObj.src = 'assets/vulf2+.jpg'; 
  }

  private createLayer() {
    const c = document.createElement('canvas');
    c.width = 800 * this.dpr;
    c.height = 600 * this.dpr;
    return c;
  }

  private initMainCanvas() {
    this.main_ctx.clearRect(0, 0, 800, 600);
    this.main_ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    this.main_ctx.lineWidth = 1;
    this.main_ctx.beginPath();
    this.main_ctx.arc(400, 300, 290, 0, Math.PI * 2);
    this.main_ctx.stroke();
    this.saveState();
  }

  private render() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, 800, 600);

    this.ctx.save();
    this.ctx.translate(400 + this.offsetX, 300 + this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-400, -300);

    if (this.isBgLoaded) {
      const imgRatio = this.bgImageObj.width / this.bgImageObj.height;
      const canvasRatio = 800 / 600;
      let dW = 800, dH = 600;
      if (imgRatio > canvasRatio) dH = 800 / imgRatio;
      else dW = 600 * imgRatio;
      this.ctx.drawImage(this.bgImageObj, (800 - dW) / 2, (600 - dH) / 2, dW, dH);
    }

    this.ctx.save();
    this.ctx.globalAlpha = 1.0; // Прозрачность всегда 100%
    this.ctx.translate(400, 300);
    this.ctx.rotate((this.angle * Math.PI) / 180);
    this.ctx.drawImage(this.main_canvas, -400, -300, 800, 600);
    this.ctx.drawImage(this.ext_layer, -400, -300, 800, 600);
    this.ctx.restore();

    this.ctx.restore();
    requestAnimationFrame(() => this.render());
  }

  public cycleZoom() {
    if (this.zoom < 1.9) this.zoom = 2;
    else if (this.zoom < 2.9) this.zoom = 3;
    else if (this.zoom < 3.9) this.zoom = 4;
    else this.zoom = 1;
  }

  public toggleMoveMode() {
    if (this.mode !== 'move') {
      this.lastDrawMode = (this.mode === 'simple' || this.mode === 'extrapolation') ? this.mode : 'extrapolation';
      this.mode = 'move';
    } else {
      this.mode = this.lastDrawMode;
    }
  }

  private getCoords(clientX: number, clientY: number) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const cssScaleX = 800 / rect.width;
    const cssScaleY = 600 / rect.height;
    let x = (clientX - rect.left) * cssScaleX;
    let y = (clientY - rect.top) * cssScaleY;
    x = (x - 400 - this.offsetX) / this.zoom;
    y = (y - 300 - this.offsetY) / this.zoom;
    const rad = (-this.angle * Math.PI) / 180;
    return {
      x: x * Math.cos(rad) - y * Math.sin(rad) + 400,
      y: x * Math.sin(rad) + y * Math.cos(rad) + 300
    };
  }

  handleInput(clientX: number, clientY: number) {
    if (this.mode === 'move') {
      this.offsetX += (clientX - this.lastMousePos.x);
      this.offsetY += (clientY - this.lastMousePos.y);
      this.lastMousePos = { x: clientX, y: clientY };
      return;
    }
    this.lastMousePos = { x: clientX, y: clientY };
    const p = this.getCoords(clientX, clientY);
    if (this.mode === 'simple') this.drawSimpleBrush(p.x, p.y);
    else if (this.mode === 'extrapolation') this.addToExtrapolation(p.x, p.y);
  }

  onMouseDown(e: MouseEvent) { this.isDrawing = true; this.lastMousePos = { x: e.clientX, y: e.clientY }; this.handleInput(e.clientX, e.clientY); }
  onMouseMove(e: MouseEvent) { if (this.isDrawing) this.handleInput(e.clientX, e.clientY); }
  onTouchStart(e: TouchEvent) { 
    e.preventDefault(); this.isDrawing = true; 
    const t = e.touches[0]; this.lastMousePos = { x: t.clientX, y: t.clientY };
    this.handleInput(t.clientX, t.clientY); 
  }
  onTouchMove(e: TouchEvent) { e.preventDefault(); if (this.isDrawing) this.handleInput(e.touches[0].clientX, e.touches[0].clientY); }
  onMouseUp() { if (this.isDrawing && this.mode === 'simple') this.saveState(); this.isDrawing = false; }

  private drawSimpleBrush(x: number, y: number) {
    this.main_ctx.fillStyle = this.brushColor;
    this.main_ctx.beginPath();
    this.main_ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    this.main_ctx.fill();
  }

  private addToExtrapolation(x: number, y: number) {
    const last = this.ext_buffer[this.ext_buffer.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 12) {
      if (this.ext_buffer.length < 18) {
        this.ext_buffer.push({ x, y });
        this.drawTarget(x, y);
      }
    }
  }

  private drawTarget(x: number, y: number) {
    this.ext_ctx.strokeStyle = '#00FF00';
    this.ext_ctx.lineWidth = 1;
    this.ext_ctx.beginPath();
    this.ext_ctx.arc(x, y, 8, 0, Math.PI * 2);
    this.ext_ctx.moveTo(x - 11, y); this.ext_ctx.lineTo(x + 11, y);
    this.ext_ctx.moveTo(x, y - 11); this.ext_ctx.lineTo(x, y + 11);
    this.ext_ctx.stroke();
  }

  public clear_points() { this.ext_buffer = []; this.ext_ctx.clearRect(0, 0, 800, 600); }

  public extrapolate() {
    if (this.ext_buffer.length < 2) return;
    this.main_ctx.strokeStyle = this.brushColor;
    this.main_ctx.lineWidth = 2;
    this.main_ctx.lineCap = 'round';
    this.main_ctx.beginPath();
    this.main_ctx.moveTo(this.ext_buffer[0].x, this.ext_buffer[0].y);
    for (let i = 0; i < this.ext_buffer.length - 1; i++) {
      const p1 = this.ext_buffer[i], p2 = this.ext_buffer[i + 1];
      this.main_ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    this.main_ctx.lineTo(this.ext_buffer[this.ext_buffer.length - 1].x, this.ext_buffer[this.ext_buffer.length - 1].y);
    this.main_ctx.stroke();
    this.saveState();
    this.clear_points();
  }

  private saveState() {
    const snapshot = this.main_canvas.toDataURL();
    if (this.history.length >= this.maxHistory) this.history.shift();
    this.history.push(snapshot);
  }

  public undo() {
    if (this.history.length <= 1) return;
    this.history.pop();
    const lastState = this.history[this.history.length - 1];
    const img = new Image();
    img.onload = () => {
      this.main_ctx.save();
      this.main_ctx.setTransform(1, 0, 0, 1, 0, 0); 
      this.main_ctx.clearRect(0, 0, this.main_canvas.width, this.main_canvas.height);
      this.main_ctx.drawImage(img, 0, 0);
      this.main_ctx.restore();
    };
    img.src = lastState;
  }

  public saveImage() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800; tempCanvas.height = 600;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.drawImage(this.main_canvas, 0, 0, 800, 600);
    const link = document.createElement('a');
    link.download = `crystools_layer_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }

  triggerFileInput() { document.getElementById('fileInput')?.click(); }
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => { this.bgImageObj = img; this.isBgLoaded = true; };
        img.src = e.target.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  triggerLayerInput() { document.getElementById('layerInput')?.click(); }
  onLayerFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => { this.main_ctx.drawImage(img, 0, 0, 800, 600); this.saveState(); };
        img.src = e.target.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  public resetView() { this.zoom = 1; this.offsetX = 0; this.offsetY = 0; }
}
