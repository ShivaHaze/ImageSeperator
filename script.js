var http    = require('http')
var fs      = require('fs') 
var Canvas  = require('canvas');
// const { createWorker } = require('tesseract.js');

// const worker = createWorker();

// (async () => {
//     await worker.load();
//     await worker.loadLanguage('eng');
//     await worker.initialize('eng');
//     await worker.setParameters({
//       tessedit_create_box: '1',
//       tessedit_create_unlv: '1',
//       tessedit_create_osd: '1',
//       tessedit_char_whitelist: '0123456789'
//     });
//     const { data: { text, hocr, tsv, box, unlv } } = await worker.recognize('https://i.stack.imgur.com/KVmJd.png');
//     //console.log(text);
//     console.log(hocr);
//     //console.log(tsv);
//     //console.log(box);
//     //console.log(unlv);
//   })();

function pixelIsTouching (coord1, coord2){

    if(coord1[0] == coord2[0] && 
      (coord1[1] == coord2[1]+1 ||
      coord1[1] == coord2[1]-1)){
        return true;
    }else if(coord1[1] == coord2[1] && 
            (coord1[0] == coord2[0]+1 ||
            coord1[0] == coord2[0]-1)){
        return true;
    }else{
        return false;
    }
}

function filterNoise(pixeldata) {
    for(var x = 0; x < pixeldata.data.length; x+=4){
        if( pixeldata.data[x] < 127) {
            pixeldata.data[x] = 0;
            pixeldata.data[x+1] = 0;
            pixeldata.data[x+2] = 0;
        }else if(pixeldata.data[x] >= 127) {
            pixeldata.data[x] = 255;
            pixeldata.data[x+1] = 255;
            pixeldata.data[x+2] = 255;
        }
    }

    return pixeldata;
}

function getBorders(pixeldata) {
    // Bilddaten pixelweise abarbeiten
    var border = [];

    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            topOffset           = (pixeldata.width * (y-1) + x) * 4;
            rTop                = pixeldata.data[topOffset];

            topRightOffset      = (pixeldata.width * (y-1) + (x+1)) * 4;
            rTopRight           = pixeldata.data[topRightOffset];

            rightOffset         = (pixeldata.width * y + (x+1)) * 4;
            rRight              = pixeldata.data[rightOffset];

            bottomRightOffset   = (pixeldata.width * (y+1) + (x+1)) * 4;
            rBottomRight        = pixeldata.data[bottomRightOffset];

            bottomOffset        = (pixeldata.width * (y+1) + x) * 4;
            rBottom             = pixeldata.data[bottomOffset];

            bottomLeftOffset    = (pixeldata.width * (y+1) + (x-1)) * 4;
            rBottomLeft         = pixeldata.data[bottomLeftOffset];

            leftOffset          = (pixeldata.width * y + (x-1)) * 4;
            rLeft               = pixeldata.data[leftOffset];
            
            topLeftOffset       = (pixeldata.width * (y-1) + (x-1)) * 4;
            rTopLeft            = pixeldata.data[topLeftOffset];

            // Check around current white pixel if black one is near
            if( r == 255 && rTop == 0 ||
                r == 255 && rTopRight == 0 ||
                r == 255 && rRight == 0 ||
                r == 255 && rBottomRight == 0 ||
                r == 255 && rBottom == 0 || 
                r == 255 && rBottomLeft == 0 ||
                r == 255 && rLeft == 0 ||
                r == 255 && rTopLeft == 0){

                    border.push([x, y]);
            }
        }
    }

    //Order border array
    var borderscounter = 0;
    var borders = [[]];

    var coordFound = undefined;

    borders[borderscounter].push(border[0]);
    border.shift();


    while(border.length > 0){

        coordFound = false;

        for(a = 0; a < border.length; a++){

            lastBlobElement = borders[borderscounter].length-1;

            if(pixelIsTouching(border[a], borders[borderscounter][lastBlobElement])){
                
                coordFound = true;
                borders[borderscounter].push(border[a]);
                border.splice(a, 1);
                
            }
        }

        if(coordFound == false && border.length > 0){
            borderscounter++;
            borders[borderscounter] = [];
            borders[borderscounter].push(border[0]);
            border.shift();
        }
    }

    return borders;
}

function drawBorders(ctx, borders) {
    // Draw Line via Border Array
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'red';
    ctx.beginPath();

    for(b = 0; b < borders.length; b++){
        for(var a = 0; a < borders[b].length; a++){

            // + 0.5 to get rid of blurry lines
            if(a == 0){
                ctx.moveTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }else{
                ctx.lineTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }

            if(a == borders[b].length-1){
                ctx.closePath();
            }
        }
    }

    ctx.stroke();
}

function saveBordersAsImages(img, borders) {
    // Calculate x and y of borders down to the edge to get a small picture
    // And get the x and y width to limit canvas size
    for(l = 0; l < borders.length; l++){
        // Smallest & Biggest X, Y coordinate on original
        smallestX = undefined;
        smallestY = undefined;
        biggestX = undefined;
        biggestY = undefined;
        // New length & height
        xLength  = undefined;
        yHeight  = undefined;

        for(y = 0; y < 4; y++){
            for(x = 0; x < borders[l].length; x++){
                if(y == 0){
                    if(x == 0){
                        smallestX = borders[l][x][0];
                        biggestX = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] < smallestX) smallestX = borders[l][x][0];
                        if(borders[l][x][0] > biggestX) biggestX = borders[l][x][0];
                    } 
                }else if(y == 1){
                    if(x == 0){
                        smallestY = borders[l][x][1];
                        biggestY = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] < smallestY) smallestY = borders[l][x][1];
                        if(borders[l][x][1] > biggestY) biggestY = borders[l][x][1];
                    } 
                }else if(y == 2){
                    borders[l][x][0] -= smallestX;
                    if(x == 0){
                        xLength = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] > xLength) xLength = borders[l][x][0];
                    } 
                }else if(y == 3){
                    borders[l][x][1] -= smallestY;
                    if(x == 0){
                        yHeight = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] > yHeight) yHeight = borders[l][x][1];
                    } 
                }
            }
        }

        xDistance = biggestX - smallestX;
        yDistance = biggestY - smallestY;

        var canvas = Canvas.createCanvas(xDistance, yDistance);
        var ctx = canvas.getContext('2d');

        // Define Clipping Path of currently first border
        ctx.beginPath();
        ctx.moveTo(borders[l][0][0], borders[l][0][1]);
        for(var i = 1; i < borders[l].length; i++){
            var p = borders[l][i];
            ctx.lineTo(borders[l][i][0], borders[l][i][1]);
        }
        ctx.closePath();
        ctx.clip();

        // Draw original Image over canvas with clipping area defined
        ctx.drawImage(img, smallestX, smallestY, xDistance, yDistance, 0, 0, xDistance, yDistance)
        var pixeldata = ctx.getImageData(0, 0, img.width, img.height);
        pixeldata = filterNoise(pixeldata);
        pixeldata = transparentToWhite(pixeldata);
        ctx.putImageData(pixeldata, 0, 0);

        // save image as file
        var file = canvas.toDataURL("image/png");

        var data = file.replace(/^data:image\/\w+;base64,/, "");
        var buf = new Buffer(data, 'base64');
        fs.writeFile('cropped/image'+ l + '.png', buf);
    }
}

function transparentToWhite(pixeldata) {
    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            if(a == 0) {
                pixeldata.data[offset] = 255;
                pixeldata.data[offset + 1] = 255;
                pixeldata.data[offset + 2] = 255;
                pixeldata.data[offset + 3] = 255;
            }
        }
    }

    return pixeldata;
}

http.createServer(function (req, res) {
    fs.readFile(__dirname + '/images/multistar_correct.jpg', function(err, data) {
        if (err) throw err;

        var img = new Canvas.Image; // Create a new Image
        img.src = data;

        // Tesseract.recognize(data).then(result => {
        //     console.log(result);
        // });

        var canvas = Canvas.createCanvas(img.width, img.height);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);

        var pixeldata = ctx.getImageData(0, 0, img.width, img.height);

        pixeldata = filterNoise(pixeldata);

        ctx.putImageData(pixeldata, 0, 0);
        
        var borders = getBorders(pixeldata);

        drawBorders(ctx, borders);

        //ctx.clearRect(0, 0, img.width, img.height);
       
        saveBordersAsImages(img, borders);

        res.write('<html><body>');
        res.write('<img src="' + canvas.toDataURL() + '" />');
        res.write('</body></html>');
        res.end();
    });

}).listen(8124, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8124/');


 

 

/*
var cannyEdgeDetector = require('canny-edge-detector');
var Image = require('image-js').Image;
 
Image.load('images/b7b.png').then((img) => {
  const grey = img.grey();
  const edge = cannyEdgeDetector(grey, { gaussianBlur:2, lowThreshold: 20, highThreshold:40 });
  return edge.save('images/edge.png');
})
*/ 

/*
var Jimp = require('jimp');
 
var title = 'b7b.png';

// open a file called "lenna.png"
Jimp.read('images/' + title , (err, picture) => {
  if (err) throw err;
  picture
    //.resize(256, 256) // resize
    //.quality(60) // set JPEG quality
    //.greyscale() // set greyscale
    //.gaussian(2)
    .blur(10)
    .write('images/edit_' + title); // save
});
*/