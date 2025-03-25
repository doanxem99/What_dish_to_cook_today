import 'package:flutter/material.dart';

class TemplatePage extends StatefulWidget {
  const TemplatePage({Key? key, required this.content}) : super(key: key);

  final Widget content;

  @override
  State<TemplatePage> createState() => _TemplatePageState();
}

class _TemplatePageState extends State<TemplatePage> {

  @override
  void initState() {
    // TODO: implement initState
    super.initState();

  }

  Widget setupMenuButton(String _name, Function _onClick)
  {
    return TextButton(onPressed : (){
      _onClick();
    }, child: Padding(
        padding: EdgeInsets.fromLTRB(5, 2, 5, 2),
        child: Text(_name, style: TextStyle(color: Colors.white, fontSize: 14))
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SizedBox.expand(
          child: Container(
            decoration: const BoxDecoration(
                image: DecorationImage(
                    image: AssetImage('assets/background/home_background.jpg'),
                    fit:  BoxFit.cover
                )
            ),
            child: Stack(
              children: <Widget>[
                Positioned.fill(
                  child: SingleChildScrollView(
                      primary: true,
                      physics: ScrollPhysics(),
                      child: Column(
                        children: [
                          SizedBox(height: 150,),
                          Padding(
                            padding: EdgeInsets.fromLTRB(90, 0, 90, 20),
                            child: widget.content,
                          ),
                        ],
                      )
                  ),
                ),
                Positioned.fill(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text("What dish to cook today ?", style: TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        SizedBox(height: 10,),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            setupMenuButton("Home", (){

                            }),
                            setupMenuButton("Dishes", (){

                            }),
                            setupMenuButton("Dishes", (){

                            }),
                            setupMenuButton("Dishes", (){

                            }),
                            setupMenuButton("About!", (){

                            }),
                          ],
                        )
                      ],
                    ),
                  ),
                ),
              ],
            ),
          )
      ),
    );
  }
}
