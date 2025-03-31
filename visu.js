let donnees = [
    { data1: 10, data2: 20, data3: 95, data4: 15, data5: 62 },
    { data1: 15, data2: 30 },
    { data1: 18, data2: 70, data3: 25, data4: 48}
  ];
  
  // Génération du polygone
  AFRAME.registerComponent('polygon', {
      schema: {
          sides: { type: 'int', default: 3, min: 3 },
          depth: { type: 'number', default: 1, min: 1 }
      },
      init: function () {
          this.updateGeometry(10); //appel de la fonction de création du polygone avec le nombre de côtés (suites) souhaités
      },
      updateGeometry: function (sides) {
        // Appel de la fonction updateDepth pour augmenter la taille du tube par rapport à la valeur la plus grande de nombre de mesures trouvéee
          const depth = this.updateDepth(1);
          const shape = new THREE.Shape();
          const angleStep = (Math.PI * 2) / sides;
  
          // Génération des points de la forme
          for (let i = 0; i < sides; i++) {
              const x = Math.cos(i * angleStep);
              const y = Math.sin(i * angleStep);
              if (i === 0) {
                  shape.moveTo(x, y);
              } else {
                  shape.lineTo(x, y);
              }
          }
          shape.closePath();
  
          // Génération de la forme
          const extrudeSettings = {
              depth: depth,
              bevelEnabled: false
          };
  
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const material = new THREE.MeshStandardMaterial({
              color: 'black',
              side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
  
          mesh.rotation.x = Math.PI / 2;
  
          this.el.setObject3D('mesh', mesh);
      },
  
      // Génération du nombre de mesures par rapport à la valeur la plus grande de nombre de mesures trouvéee
      updateDepth: function (sides) {
          return (sides/4);
      }
  });