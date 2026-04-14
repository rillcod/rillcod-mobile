import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { CodeData, VisualizationType } from '../../types/visualizer';

interface P5WrapperProps {
  type: VisualizationType;
  data: CodeData;
  isPlaying: boolean;
  speed: number;
  onMessage?: (event: any) => void;
}

/**
 * P5Wrapper - Mobile implementation of the P5 rendering engine.
 * Uses WebView to run P5.js sketches with 1:1 web parity.
 */
export const P5Wrapper: React.FC<P5WrapperProps> = ({ type, data, isPlaying, speed }) => {
  const webViewRef = useRef<WebView>(null);

  // Synchronize data with the WebView sketch
  useEffect(() => {
    if (webViewRef.current) {
      const script = `
        if (window.p5Instance && window.p5Instance.updateData) {
          window.p5Instance.updateData(${JSON.stringify(data)}, ${isPlaying}, ${speed});
        }
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [data, isPlaying, speed]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.6.0/p5.min.js"></script>
        <style>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; background: #000; }
          canvas { display: block; filter: drop-shadow(0 0 10px rgba(6, 182, 210, 0.3)); }
          #canvas-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        </style>
      </head>
      <body>
        <div id="canvas-container"></div>
        <script>
          // Error Reporting Bridge
          window.onerror = function(msg, url, line) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg, line: line }));
          };

          window.p5Instance = null;
          window.isPlayingInternal = ${isPlaying};

          const sketch = (p) => {
            let data = ${JSON.stringify(data)};
            let isPlaying = ${isPlaying};
            let speed = ${speed};

            const SKETCHES = {
              sorting: (p, data) => {
                let bars = data.visualizationState?.array || [];
                let comparing = data.visualizationState?.comparing || [];
                let targetBars = [...bars];
                let lerpedBars = [...bars];
                
                p.setup = () => {
                  p.createCanvas(p.windowWidth, p.windowHeight);
                  p.colorMode(p.HSB, 360, 100, 100, 1);
                };

                p.draw = () => {
                  p.clear();
                  const margin = 20;
                  const w = (p.width - margin * 2) / Math.max(bars.length, 1);
                  
                  for (let i = 0; i < bars.length; i++) {
                    lerpedBars[i] = p.lerp(lerpedBars[i] || 0, targetBars[i] || 0, 0.1);
                    const h = p.map(lerpedBars[i], 0, Math.max(...bars, 1), 20, p.height - 60);
                    const x = margin + i * w;
                    
                    p.noStroke();
                    if (comparing.includes(i)) {
                      p.fill(180, 80, 100); 
                    } else {
                      p.fill(200 + (i / bars.length) * 50, 60, 80, 0.6);
                    }
                    p.rect(x, p.height - h - 10, w - 2, h, 2);
                  }
                };

                p.updateData = (newData) => {
                  targetBars = newData.visualizationState?.array || [];
                  comparing = newData.visualizationState?.comparing || [];
                  if (bars.length !== targetBars.length) {
                    bars = [...targetBars];
                    lerpedBars = [...targetBars];
                  }
                };
              },
              physics: (p, data) => {
                let balls = [];
                class Ball {
                  constructor(x, y, vx, vy, r, h) {
                    this.pos = p.createVector(x * p.width, y * p.height);
                    this.vel = p.createVector(vx, vy);
                    this.radius = r || 20;
                    this.hue = h || 120;
                    this.history = [];
                  }
                  update() {
                    this.vel.y += 0.2 * speed; 
                    this.pos.add(p5.Vector.mult(this.vel, speed));
                    if (this.pos.y > p.height - this.radius) {
                      this.pos.y = p.height - this.radius;
                      this.vel.y *= -0.8;
                    }
                    if (this.pos.x > p.width - this.radius || this.pos.x < this.radius) {
                      this.vel.x *= -0.8;
                      this.pos.x = p.constrain(this.pos.x, this.radius, p.width - this.radius);
                    }
                    this.history.push(this.pos.copy());
                    if (this.history.length > 10) this.history.shift();
                  }
                  display() {
                    p.noStroke();
                    for(let i=0; i<this.history.length; i++) {
                      let opacity = p.map(i, 0, this.history.length, 0, 0.3);
                      p.fill(this.hue, 80, 100, opacity);
                      p.ellipse(this.history[i].x, this.history[i].y, this.radius * (i/this.history.length) * 2);
                    }
                    p.fill(this.hue, 80, 100, 0.8);
                    p.ellipse(this.pos.x, this.pos.y, this.radius * 2);
                  }
                }

                p.setup = () => {
                  p.createCanvas(p.windowWidth, p.windowHeight);
                  p.colorMode(p.HSB, 360, 100, 100, 1);
                  const initial = data.visualizationState?.balls || [];
                  balls = initial.map(b => new Ball(b.x, b.y, b.vx, b.vy, b.radius, b.hue));
                };

                p.draw = () => {
                  p.clear();
                  balls.forEach(b => {
                    if (window.isPlayingInternal) b.update();
                    b.display();
                  });
                };

                p.updateData = (newData, playing, s) => {
                   window.isPlayingInternal = playing;
                   speed = s || 1;
                   const next = newData.visualizationState?.balls || [];
                   if (next.length !== balls.length) {
                     balls = next.map(b => new Ball(b.x, b.y, b.vx, b.vy, b.radius, b.hue));
                   }
                };
              },
              turtle: (p, data) => {
                let path = [];
                let currentPos;
                let targetPos;
                
                p.setup = () => {
                  p.createCanvas(p.windowWidth, p.windowHeight);
                  p.colorMode(p.HSB, 360, 100, 100, 1);
                  currentPos = p.createVector(p.width/2, p.height/2);
                  targetPos = p.createVector(p.width/2, p.height/2);
                };

                p.draw = () => {
                  p.clear();
                  currentPos = p5.Vector.lerp(currentPos, targetPos, 0.1);
                  p.noFill();
                  p.stroke(80, 80, 100);
                  p.strokeWeight(3);
                  p.beginShape();
                  path.forEach(v => p.vertex(v.x * p.width, v.y * p.height));
                  p.vertex(currentPos.x, currentPos.y);
                  p.endShape();
                  
                  p.fill(255);
                  p.noStroke();
                  p.ellipse(currentPos.x, currentPos.y, 10);
                };

                p.updateData = (newData) => {
                  const state = newData.visualizationState?.turtle || {x:0.5,y:0.5,path:[]};
                  targetPos = p.createVector(state.x * p.width, state.y * p.height);
                  path = state.path || [];
                };
              },
              loops: (p, data) => {
                let count = data.variables?.i || 0;
                let max = data.variables?.n || 10;
                let particles = [];
                
                p.setup = () => {
                  p.createCanvas(p.windowWidth, p.windowHeight);
                  p.colorMode(p.HSB, 360, 100, 100, 1);
                };

                p.draw = () => {
                  p.clear();
                  p.translate(p.width/2, p.height/2);
                  const radius = Math.min(p.width, p.height) * 0.35;
                  
                  for (let i = 0; i < count; i++) {
                    const angle = p.map(i, 0, max, 0, p.TWO_PI);
                    const x = p.cos(angle) * radius;
                    const y = p.sin(angle) * radius;
                    
                    p.noStroke();
                    p.fill(330, 80, 100, 0.6);
                    p.ellipse(x, y, 20);
                    
                    p.stroke(330, 80, 100, 0.2);
                    p.line(0, 0, x, y);
                  }
                };

                p.updateData = (newData) => {
                  count = newData.variables?.i || 0;
                  max = newData.variables?.n || 10;
                };
              },
              stateMachine: (p, data) => {
                let nodes = [];
                let connections = [];
                let current = data.variables?.state || 0;

                class Node {
                  constructor(label, x, y, id) {
                    this.label = label;
                    this.pos = p.createVector(x * p.width, y * p.height);
                    this.id = id;
                    this.lerpedSize = 40;
                  }
                  display(active) {
                    const targetSize = active ? 60 : 40;
                    this.lerpedSize = p.lerp(this.lerpedSize, targetSize, 0.1);
                    
                    if (active) {
                      p.noFill();
                      p.stroke(25, 100, 100, 0.4);
                      p.ellipse(this.pos.x, this.pos.y, this.lerpedSize + p.sin(p.frameCount * 0.1) * 10);
                    }
                    
                    p.fill(active ? 25 : 200, 80, 100, 0.8);
                    p.noStroke();
                    p.ellipse(this.pos.x, this.pos.y, this.lerpedSize);
                    
                    p.fill(255);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(10);
                    p.text(this.label, this.pos.x, this.pos.y);
                  }
                }

                p.setup = () => {
                  p.createCanvas(p.windowWidth, p.windowHeight);
                  p.colorMode(p.HSB, 360, 100, 100, 1);
                  const stateData = data.visualizationState?.states || [];
                  nodes = stateData.map((s, i) => new Node(s.label, s.x, s.y, i));
                  connections = data.visualizationState?.connections || [];
                };

                p.draw = () => {
                  p.clear();
                  connections.forEach(c => {
                    const f = nodes[c.from];
                    const t = nodes[c.to];
                    if (f && t) {
                      p.stroke(255, 0.2);
                      p.line(f.pos.x, f.pos.y, t.pos.x, t.pos.y);
                      
                      const progress = (p.frameCount * 0.02 * speed) % 1;
                      const px = p.lerp(f.pos.x, t.pos.x, progress);
                      const py = p.lerp(f.pos.y, t.pos.y, progress);
                      p.fill(25, 100, 100, 0.6);
                      p.noStroke();
                      p.ellipse(px, py, 4);
                    }
                  });
                  nodes.forEach((n, i) => n.display(i === current));
                };

                p.updateData = (newData) => {
                  current = newData.variables?.state || 0;
                  const nextStates = newData.visualizationState?.states || [];
                  if (nextStates.length !== nodes.length) {
                    nodes = nextStates.map((s, i) => new Node(s.label, s.x, s.y, i));
                    connections = newData.visualizationState?.connections || [];
                  }
                };
              }
            };

            window.p5Instance = p;
            (SKETCHES['${type}'] || SKETCHES['sorting'])(p, data);

            p.windowResized = () => {
              p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
          };

          new p5(sketch, 'canvas-container');
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={onMessage}
        scrollEnabled={false}
        overScrollMode="never"
        style={styles.webview}
        transparent={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#06b6d2" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
