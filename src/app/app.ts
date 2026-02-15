import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
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

  public angle = 0;
  public opacity = 100;
  public mode: 'simple' | 'extrapolation' = 'extrapolation';
  public ext_buffer: {x: number, y: number}[] = [];
  public backgroundImage: string | null = "assets/vulf2+.jpg";
  private isDrawing = false;
  
  public encodeURI(uri: string): string {
  return encodeURIComponent(uri).replace(/%2F/g, '/');
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    
    this.main_canvas = this.createLayer();
    this.main_ctx = this.main_canvas.getContext('2d')!;
    this.ext_layer = this.createLayer();
    this.ext_ctx = this.ext_layer.getContext('2d')!;

    canvas.width = 800;
    canvas.height = 600;
    
    this.initMainCanvas();
    this.render();
  }

  private createLayer() {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 600;
    return c;
  }

  private initMainCanvas() {
    this.main_ctx.clearRect(0, 0, 800, 600);
    this.main_ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; 
    this.main_ctx.lineWidth = 1;
    this.main_ctx.beginPath();
    this.main_ctx.arc(400, 300, 290, 0, Math.PI * 2);
    this.main_ctx.stroke();
  }

  private render() {
    this.ctx.clearRect(0, 0, 800, 600);
    this.ctx.save();
    this.ctx.globalAlpha = this.opacity / 100;
    this.ctx.translate(400, 300);
    this.ctx.rotate((this.angle * Math.PI) / 180);
    this.ctx.drawImage(this.main_canvas, -400, -300);
    this.ctx.drawImage(this.ext_layer, -400, -300);
    this.ctx.restore();
    requestAnimationFrame(() => this.render());
  }

  private getCoords(e: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) - 400;
    const y = (e.clientY - rect.top) - 300;
    const rad = (-this.angle * Math.PI) / 180;
    return {
      x: x * Math.cos(rad) - y * Math.sin(rad) + 400,
      y: x * Math.sin(rad) + y * Math.cos(rad) + 300
    };
  }

  onMouseDown(e: MouseEvent) { this.isDrawing = true; this.handleDrawing(e); }
  onMouseMove(e: MouseEvent) { if (this.isDrawing) this.handleDrawing(e); }
  onMouseUp() { this.isDrawing = false; }

  private handleDrawing(e: MouseEvent) {
    const p = this.getCoords(e);
    if (this.mode === 'simple') {
      this.drawSimpleBrush(p.x, p.y);
    } else {
      this.addToExtrapolation(p.x, p.y);
    }
  }

  private drawSimpleBrush(x: number, y: number) {
    this.main_ctx.strokeStyle = 'red';
    this.main_ctx.lineWidth = 2;
    this.main_ctx.beginPath();
    this.main_ctx.arc(x, y, 8, 0, Math.PI * 2);
    this.main_ctx.stroke();
    this.main_ctx.fillStyle = 'red';
    this.main_ctx.beginPath();
    this.main_ctx.arc(x, y, 2, 0, Math.PI * 2);
    this.main_ctx.fill();
  }

  private addToExtrapolation(x: number, y: number) {
    const last = this.ext_buffer[this.ext_buffer.length - 1];
    const dist = last ? Math.hypot(x - last.x, y - last.y) : 100;
    if (dist > 12 && this.ext_buffer.length < 18) {
      this.ext_buffer.push({x, y});
      this.drawTarget(x, y);
    }
  }

  private drawTarget(x: number, y: number) {
    const r = 10;
    this.ext_ctx.strokeStyle = '#00FF00';
    this.ext_ctx.lineWidth = 2;
    this.ext_ctx.beginPath();
    this.ext_ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ext_ctx.stroke();
    this.ext_ctx.beginPath();
    this.ext_ctx.moveTo(x-r-3, y); this.ext_ctx.lineTo(x+r+3, y);
    this.ext_ctx.moveTo(x, y-r-3); this.ext_ctx.lineTo(x, y+r+3);
    this.ext_ctx.stroke();
  }

  public clear_points() {
    this.ext_buffer = [];
    this.ext_ctx.clearRect(0, 0, 800, 600);
  }

  public extrapolate() {
    if (this.ext_buffer.length < 2) return;
    this.main_ctx.strokeStyle = '#00FF00';
    this.main_ctx.lineWidth = 3;
    this.main_ctx.lineCap = 'round';
    this.main_ctx.beginPath();
    this.main_ctx.moveTo(this.ext_buffer[0].x, this.ext_buffer[0].y);
    for (let i = 0; i < this.ext_buffer.length - 1; i++) {
      const p1 = this.ext_buffer[i];
      const p2 = this.ext_buffer[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      this.main_ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    const last = this.ext_buffer[this.ext_buffer.length - 1];
    this.main_ctx.lineTo(last.x, last.y);
    this.main_ctx.stroke();
    this.clear_points();
  }

  triggerFileInput() { document.getElementById('fileInput')?.click(); }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.backgroundImage = e.target.result;
        // Принудительно вызываем обновление через изменение угла на мизер
        this.angle += 0.00001; 
      };
      reader.readAsDataURL(file);
    }
  }
}